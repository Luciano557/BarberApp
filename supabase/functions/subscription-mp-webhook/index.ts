/**
 * Mercado Pago webhook for Vittro subscriptions.
 *
 * Public endpoint. It validates x-signature when MERCADOPAGO_WEBHOOK_SECRET is
 * configured, logs the raw event, and best-effort syncs local subscription state.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createAdminClient } from '../_shared/subscription-billing.ts';
import { mpPlatformFetch, readMpError } from '../_shared/mp-client.ts';

const webhookCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...webhookCorsHeaders, 'Content-Type': 'application/json' },
  });
}

async function validateMpSignature(req: Request): Promise<boolean> {
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
  if (!secret) {
    console.warn('[subscription-mp-webhook] MERCADOPAGO_WEBHOOK_SECRET not configured, skipping validation');
    return true;
  }

  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');
  if (!xSignature || !xRequestId) return false;

  const parts = Object.fromEntries(
    xSignature.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key.trim(), value.trim()];
    }),
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const url = new URL(req.url);
  const dataId = url.searchParams.get('data.id') ?? '';
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(manifest);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const computed = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return computed === v1;
}

function payloadDataId(payload: Record<string, unknown>, req: Request): string | null {
  const url = new URL(req.url);
  const queryId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
  const data = payload.data as Record<string, unknown> | undefined;
  const nestedId = data?.id;
  const directId = payload.id;

  return String(queryId ?? nestedId ?? directId ?? '') || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function pendingPreapprovalId(
  subscription: { metadata?: unknown; mercadopago_preapproval_id?: unknown; mercadopago_status?: unknown },
): string | null {
  const metadata = isRecord(subscription.metadata) ? subscription.metadata : {};
  const metadataId = asNonEmptyString(metadata.pending_mercadopago_preapproval_id);
  if (metadataId) return metadataId;

  return subscription.mercadopago_status === 'pending'
    ? asNonEmptyString(subscription.mercadopago_preapproval_id)
    : null;
}

function withoutPendingCheckoutMetadata(value: unknown): Record<string, unknown> {
  const metadata = isRecord(value) ? { ...value } : {};
  delete metadata.pending_mercadopago_preapproval_id;
  delete metadata.pending_mercadopago_external_reference;
  delete metadata.pending_checkout_amount_ars;
  delete metadata.pending_checkout_price_version;
  delete metadata.checkout_requested_at;
  delete metadata.checkout_requested_by;
  delete metadata.previous_mercadopago_preapproval_id;
  delete metadata.previous_mercadopago_external_reference;
  return metadata;
}

function withoutScheduledRenewalMetadata(value: unknown): Record<string, unknown> {
  const metadata = isRecord(value) ? { ...value } : {};
  delete metadata.scheduled_renewal_amount_ars;
  delete metadata.scheduled_renewal_price_version;
  return metadata;
}

function finiteAmount(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function positiveVersion(value: unknown): number | null {
  const version = Number(value);
  return Number.isInteger(version) && version > 0 ? version : null;
}

function parseSubscriptionExternalReference(value: string | null | undefined): {
  organizationId: string;
  planCode: string;
} | null {
  if (!value) return null;

  const match = value.match(/^sub_([0-9a-fA-F-]{36})_(basico|profesional|premium)_/);
  if (!match) return null;

  return {
    organizationId: match[1],
    planCode: match[2],
  };
}

function eventTopic(payload: Record<string, unknown>): string {
  return String(payload.type ?? payload.topic ?? payload.action ?? 'unknown');
}

function isPreapprovalEvent(topic: string, action?: string): boolean {
  const value = `${topic} ${action ?? ''}`.toLowerCase();
  return value.includes('preapproval') || value.includes('subscription_preapproval');
}

function isAuthorizedPaymentEvent(topic: string, action?: string): boolean {
  const value = `${topic} ${action ?? ''}`.toLowerCase();
  return value.includes('authorized_payment') || value.includes('subscription_authorized_payment');
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function mapSubscriptionStatus(mpStatus: string | null | undefined, fallback: string | null): string {
  switch ((mpStatus ?? '').toLowerCase()) {
    case 'authorized':
    case 'active':
      return 'active';
    case 'paused':
      return 'past_due';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'pending':
      return fallback ?? 'expired';
    default:
      return fallback ?? 'expired';
  }
}

function mapPaymentStatus(mpStatus: string | null | undefined): string {
  switch ((mpStatus ?? '').toLowerCase()) {
    case 'approved':
    case 'accredited':
      return 'approved';
    case 'in_process':
      return 'in_process';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'charged_back':
      return 'charged_back';
    default:
      return 'pending';
  }
}

async function syncPreapproval(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  preapprovalId: string,
  eventRowId: string | null,
) {
  const mpRes = await mpPlatformFetch(`/preapproval/${preapprovalId}`);
  if (!mpRes.ok) {
    const mpError = await readMpError(mpRes);
    console.warn('[subscription-mp-webhook] preapproval fetch failed:', mpRes.status, mpError.code);
    return;
  }

  const preapproval = await mpRes.json();
  const externalReference = preapproval.external_reference as string | undefined;
  const parsedExternalReference = parseSubscriptionExternalReference(externalReference);

  let { data: subscription } = await supabaseAdmin
    .from('organization_subscriptions')
    .select('id, organization_id, status, current_plan_code, pending_plan_code, effective_plan_code, billing_plan_code, billing_amount_ars, billing_price_version, pending_checkout_amount_ars, pending_checkout_price_version, current_period_start, current_period_end, next_payment_date, mercadopago_preapproval_id, mercadopago_status, metadata')
    .eq('mercadopago_preapproval_id', String(preapprovalId))
    .maybeSingle();

  if (!subscription) {
    const pendingFallback = await supabaseAdmin
      .from('organization_subscriptions')
      .select('id, organization_id, status, current_plan_code, pending_plan_code, effective_plan_code, billing_plan_code, billing_amount_ars, billing_price_version, pending_checkout_amount_ars, pending_checkout_price_version, current_period_start, current_period_end, next_payment_date, mercadopago_preapproval_id, mercadopago_status, metadata')
      .contains('metadata', { pending_mercadopago_preapproval_id: String(preapprovalId) })
      .maybeSingle();
    subscription = pendingFallback.data;
  }

  if (!subscription && externalReference) {
    const referenceFallback = await supabaseAdmin
      .from('organization_subscriptions')
      .select('id, organization_id, status, current_plan_code, pending_plan_code, effective_plan_code, billing_plan_code, billing_amount_ars, billing_price_version, pending_checkout_amount_ars, pending_checkout_price_version, current_period_start, current_period_end, next_payment_date, mercadopago_preapproval_id, mercadopago_status, metadata')
      .eq('mercadopago_external_reference', externalReference)
      .maybeSingle();
    subscription = referenceFallback.data;
  }

  if (!subscription && parsedExternalReference) {
    const fallback = await supabaseAdmin
      .from('organization_subscriptions')
      .select('id, organization_id, status, current_plan_code, pending_plan_code, effective_plan_code, billing_plan_code, billing_amount_ars, billing_price_version, pending_checkout_amount_ars, pending_checkout_price_version, current_period_start, current_period_end, next_payment_date, mercadopago_preapproval_id, mercadopago_status, metadata')
      .eq('organization_id', parsedExternalReference.organizationId)
      .maybeSingle();
    subscription = fallback.data;
  }

  if (!subscription) {
    console.warn('[subscription-mp-webhook] subscription not found for preapproval:', preapprovalId);
    return;
  }

  const localPendingPreapprovalId = pendingPreapprovalId(subscription);
  const isPendingCheckout = localPendingPreapprovalId === String(preapprovalId);
  const isCurrentPreapproval = subscription.mercadopago_preapproval_id === String(preapprovalId);

  if (!isPendingCheckout && !isCurrentPreapproval) {
    console.warn('[subscription-mp-webhook] ignored stale preapproval:', preapprovalId);
    if (eventRowId) {
      await supabaseAdmin
        .from('mercadopago_subscription_events')
        .update({
          organization_id: subscription.organization_id,
          subscription_id: subscription.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', eventRowId);
    }
    return;
  }

  const nextStatus = mapSubscriptionStatus(preapproval.status as string | undefined, subscription.status);
  const nextPaymentDate = preapproval.next_payment_date
    ? new Date(preapproval.next_payment_date as string)
    : null;
  const preservesCurrentProvider = isPendingCheckout && !isCurrentPreapproval && Boolean(subscription.current_plan_code);
  const pendingCheckoutTerminated = isPendingCheckout && (
    nextStatus === 'cancelled' || nextStatus === 'past_due'
  );
  const subscriptionUpdate: Record<string, unknown> = {
    // A preapproval becoming authorized is not proof of an approved debit.
    // Plan, billing snapshot and paid period are promoted only by the
    // authorized_payment branch below.
    status: isPendingCheckout ? subscription.status : nextStatus,
    pending_plan_code: pendingCheckoutTerminated ? null : subscription.pending_plan_code,
    next_payment_date: isPendingCheckout
      ? subscription.next_payment_date
      : nextPaymentDate?.toISOString() ?? null,
  };

  if (!preservesCurrentProvider) {
    subscriptionUpdate.mercadopago_status = preapproval.status ?? null;
    subscriptionUpdate.mercadopago_init_point = preapproval.init_point ?? preapproval.sandbox_init_point ?? null;
    subscriptionUpdate.mercadopago_external_reference = externalReference ?? null;
  }

  if (pendingCheckoutTerminated) {
    subscriptionUpdate.pending_checkout_amount_ars = null;
    subscriptionUpdate.pending_checkout_price_version = null;
    subscriptionUpdate.mercadopago_init_point = null;
    subscriptionUpdate.metadata = withoutPendingCheckoutMetadata(subscription.metadata);
  }

  const { error: subscriptionUpdateError } = await supabaseAdmin
    .from('organization_subscriptions')
    .update(subscriptionUpdate)
    .eq('id', subscription.id);

  if (subscriptionUpdateError) {
    console.error('[subscription-mp-webhook] preapproval sync failed:', subscriptionUpdateError.code);
    return;
  }

  if (eventRowId) {
    await supabaseAdmin
      .from('mercadopago_subscription_events')
      .update({
        organization_id: subscription.organization_id,
        subscription_id: subscription.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', eventRowId);
  }
}

async function syncAuthorizedPayment(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  authorizedPaymentId: string,
  eventRowId: string | null,
) {
  const mpRes = await mpPlatformFetch(`/authorized_payments/${authorizedPaymentId}`);
  if (!mpRes.ok) {
    const mpError = await readMpError(mpRes);
    console.warn('[subscription-mp-webhook] authorized payment fetch failed:', mpRes.status, mpError.code);
    return;
  }

  const authorizedPayment = await mpRes.json();
  const preapprovalId =
    authorizedPayment.preapproval_id ??
    authorizedPayment.subscription_id ??
    authorizedPayment.preapproval?.id;

  if (!preapprovalId) {
    console.warn('[subscription-mp-webhook] authorized payment without preapproval:', authorizedPaymentId);
    return;
  }

  let externalReference =
    typeof authorizedPayment.external_reference === 'string'
      ? authorizedPayment.external_reference
      : null;

  if (!externalReference) {
    const preapprovalRes = await mpPlatformFetch(`/preapproval/${preapprovalId}`);
    if (preapprovalRes.ok) {
      const preapproval = await preapprovalRes.json();
      externalReference = typeof preapproval.external_reference === 'string'
        ? preapproval.external_reference
        : null;
    }
  }

  const parsedExternalReference = parseSubscriptionExternalReference(externalReference);

  let { data: subscription } = await supabaseAdmin
    .from('organization_subscriptions')
    .select('id, organization_id, status, current_plan_code, effective_plan_code, pending_plan_code, billing_plan_code, billing_amount_ars, billing_price_version, pending_checkout_amount_ars, pending_checkout_price_version, current_period_start, current_period_end, mercadopago_preapproval_id, mercadopago_external_reference, mercadopago_status, metadata')
    .eq('mercadopago_preapproval_id', String(preapprovalId))
    .maybeSingle();

  if (!subscription) {
    const pendingFallback = await supabaseAdmin
      .from('organization_subscriptions')
      .select('id, organization_id, status, current_plan_code, effective_plan_code, pending_plan_code, billing_plan_code, billing_amount_ars, billing_price_version, pending_checkout_amount_ars, pending_checkout_price_version, current_period_start, current_period_end, mercadopago_preapproval_id, mercadopago_external_reference, mercadopago_status, metadata')
      .contains('metadata', { pending_mercadopago_preapproval_id: String(preapprovalId) })
      .maybeSingle();
    subscription = pendingFallback.data;
  }

  if (!subscription && parsedExternalReference) {
    const fallback = await supabaseAdmin
      .from('organization_subscriptions')
      .select('id, organization_id, status, current_plan_code, effective_plan_code, pending_plan_code, billing_plan_code, billing_amount_ars, billing_price_version, pending_checkout_amount_ars, pending_checkout_price_version, current_period_start, current_period_end, mercadopago_preapproval_id, mercadopago_external_reference, mercadopago_status, metadata')
      .eq('organization_id', parsedExternalReference.organizationId)
      .maybeSingle();
    subscription = fallback.data;
  }

  if (!subscription) {
    console.warn('[subscription-mp-webhook] subscription not found for authorized payment:', authorizedPaymentId);
    return;
  }

  const localPendingPreapprovalId = pendingPreapprovalId(subscription);
  const isPendingCheckout = localPendingPreapprovalId === String(preapprovalId);
  const isCurrentPreapproval = subscription.mercadopago_preapproval_id === String(preapprovalId);
  const isScheduledRenewal = !isPendingCheckout && isCurrentPreapproval && Boolean(subscription.pending_plan_code);

  if (!isPendingCheckout && !isCurrentPreapproval) {
    console.warn('[subscription-mp-webhook] ignored stale authorized payment:', authorizedPaymentId);
    if (eventRowId) {
      await supabaseAdmin
        .from('mercadopago_subscription_events')
        .update({
          organization_id: subscription.organization_id,
          subscription_id: subscription.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', eventRowId);
    }
    return;
  }

  const paymentStatus = mapPaymentStatus(authorizedPayment.status as string | undefined);
  const amount = finiteAmount(
    authorizedPayment.transaction_amount ??
    authorizedPayment.amount ??
    authorizedPayment.payment?.transaction_amount ??
    0,
  ) ?? 0;
  const paidAt = paymentStatus === 'approved'
    ? new Date(
      authorizedPayment.date_approved ??
      authorizedPayment.last_modified ??
      authorizedPayment.date_created ??
      Date.now(),
    ).toISOString()
    : null;
  const planCode =
    (isPendingCheckout ? parsedExternalReference?.planCode : null) ??
    ((isPendingCheckout || isScheduledRenewal) ? subscription.pending_plan_code : null) ??
    subscription.billing_plan_code ??
    subscription.current_plan_code ??
    subscription.effective_plan_code ??
    'basico';
  const pendingAmount = finiteAmount(subscription.pending_checkout_amount_ars);
  const pendingPriceVersion = positiveVersion(subscription.pending_checkout_price_version);
  const currencyId = String(authorizedPayment.currency_id ?? 'ARS');
  const pendingPlanMatchesReference =
    !isPendingCheckout ||
    !parsedExternalReference?.planCode ||
    !subscription.pending_plan_code ||
    parsedExternalReference.planCode === subscription.pending_plan_code;
  const pendingCheckoutMatchesStoredPrice =
    !isPendingCheckout ||
    (
      pendingPlanMatchesReference &&
      pendingAmount !== null &&
      pendingPriceVersion !== null &&
      amount === pendingAmount &&
      currencyId === 'ARS'
    );
  const subscriptionMetadata = isRecord(subscription.metadata) ? subscription.metadata : {};
  const scheduledAmount = finiteAmount(subscriptionMetadata.scheduled_renewal_amount_ars);
  const scheduledPriceVersion = positiveVersion(subscriptionMetadata.scheduled_renewal_price_version);
  const scheduledRenewalMatchesStoredPrice = !isScheduledRenewal || scheduledAmount === null || (
    amount === scheduledAmount && currencyId === 'ARS'
  );

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('subscription_payments')
    .upsert({
      organization_id: subscription.organization_id,
      subscription_id: subscription.id,
      plan_code: planCode,
      billing_plan_code: planCode,
      amount_ars: amount,
      currency_id: currencyId,
      status: paymentStatus,
      provider: 'mercadopago',
      mercadopago_authorized_payment_id: String(authorizedPaymentId),
      mercadopago_payment_id: authorizedPayment.payment_id ? String(authorizedPayment.payment_id) : null,
      mercadopago_preapproval_id: String(preapprovalId),
      period_start: subscription.current_period_start,
      period_end: subscription.current_period_end,
      due_at: authorizedPayment.payment_date ?? authorizedPayment.date_created ?? null,
      paid_at: paidAt,
      raw_payload: authorizedPayment,
    }, { onConflict: 'mercadopago_authorized_payment_id' })
    .select('id')
    .maybeSingle();

  if (paymentError) {
    console.error('[subscription-mp-webhook] payment upsert failed:', paymentError.code);
    return;
  }

  if (
    paymentStatus === 'approved' &&
    (!pendingCheckoutMatchesStoredPrice || !scheduledRenewalMatchesStoredPrice)
  ) {
    console.error('[subscription-mp-webhook] subscription price mismatch:', {
      authorizedPaymentId,
      preapprovalId: String(preapprovalId),
      planCode,
    });

    if (eventRowId) {
      await supabaseAdmin
        .from('mercadopago_subscription_events')
        .update({
          organization_id: subscription.organization_id,
          subscription_id: subscription.id,
          payment_id: payment?.id ?? null,
        })
        .eq('id', eventRowId);
    }
    return;
  }

  if (paymentStatus === 'approved') {
    const nextPaymentDate = authorizedPayment.next_payment_date
      ? new Date(authorizedPayment.next_payment_date as string)
      : null;
    const periodStart = paidAt ? new Date(paidAt) : new Date();
    const periodEnd = nextPaymentDate ?? addMonths(periodStart, 1);

    const metadata = subscriptionMetadata;
    const previousPreapprovalId = isPendingCheckout && typeof metadata.previous_mercadopago_preapproval_id === 'string'
      ? metadata.previous_mercadopago_preapproval_id
      : null;
    let confirmedPriceVersion = isPendingCheckout
      ? pendingPriceVersion
      : isScheduledRenewal
        ? scheduledPriceVersion
        : positiveVersion(subscription.billing_price_version);
    const confirmedBillingAmount = isPendingCheckout && pendingAmount !== null
      ? pendingAmount
      : amount;

    if (
      !isPendingCheckout &&
      (!confirmedPriceVersion || finiteAmount(subscription.billing_amount_ars) !== amount)
    ) {
      const { data: catalogPlan } = await supabaseAdmin
        .from('subscription_plans')
        .select('amount_ars, price_version')
        .eq('code', planCode)
        .maybeSingle();

      confirmedPriceVersion = catalogPlan && finiteAmount(catalogPlan.amount_ars) === amount
        ? positiveVersion(catalogPlan.price_version)
        : null;
    }

    const confirmedMetadata = {
      ...(isPendingCheckout
        ? withoutPendingCheckoutMetadata(metadata)
        : isScheduledRenewal
          ? withoutScheduledRenewalMetadata(metadata)
          : metadata),
      last_confirmed_mercadopago_preapproval_id: String(preapprovalId),
      last_confirmed_mercadopago_external_reference: externalReference,
      last_confirmed_plan_code: planCode,
      last_confirmed_payment_at: paidAt,
      last_confirmed_amount_ars: confirmedBillingAmount,
      last_confirmed_price_version: confirmedPriceVersion,
    };

    const subscriptionUpdate: Record<string, unknown> = {
      status: 'active',
      current_plan_code: planCode,
      effective_plan_code: planCode,
      billing_plan_code: planCode,
      billing_amount_ars: confirmedBillingAmount,
      billing_price_version: confirmedPriceVersion,
      mercadopago_preapproval_id: String(preapprovalId),
      mercadopago_external_reference: externalReference ?? subscription.mercadopago_external_reference,
      mercadopago_status: 'authorized',
      next_payment_date: nextPaymentDate?.toISOString() ?? null,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      last_payment_at: paidAt,
      metadata: confirmedMetadata,
    };

    if (isPendingCheckout || isScheduledRenewal) {
      subscriptionUpdate.pending_plan_code = null;
    }
    if (isPendingCheckout) {
      subscriptionUpdate.pending_checkout_amount_ars = null;
      subscriptionUpdate.pending_checkout_price_version = null;
    }

    const { error: subscriptionUpdateError } = await supabaseAdmin
      .from('organization_subscriptions')
      .update(subscriptionUpdate)
      .eq('id', subscription.id);

    if (subscriptionUpdateError) {
      console.error('[subscription-mp-webhook] approved payment sync failed:', subscriptionUpdateError.code);
      return;
    }

    if (previousPreapprovalId && previousPreapprovalId !== String(preapprovalId)) {
      const cancelPreviousRes = await mpPlatformFetch(`/preapproval/${previousPreapprovalId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!cancelPreviousRes.ok) {
        const mpError = await readMpError(cancelPreviousRes);
        console.warn('[subscription-mp-webhook] previous preapproval cancel failed:', cancelPreviousRes.status, mpError.code);
      }
    }
  } else if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
    const hasCurrentPaidAccess = Boolean(
      subscription.current_plan_code &&
      subscription.current_period_end &&
      Number.isFinite(Date.parse(subscription.current_period_end)) &&
      Date.parse(subscription.current_period_end) > Date.now(),
    );

    const failureUpdate: Record<string, unknown> = {
      status: hasCurrentPaidAccess
        ? (subscription.status === 'active' ? 'active' : subscription.status)
        : 'past_due',
    };

    // A rejected/cancelled authorized-payment is an attempt outcome, not a
    // terminal preapproval state. Keep the immutable pending intent so a later
    // Mercado Pago retry is still resolved to the same plan/amount/version.

    const { error: subscriptionUpdateError } = await supabaseAdmin
      .from('organization_subscriptions')
      .update(failureUpdate)
      .eq('id', subscription.id);

    if (subscriptionUpdateError) {
      console.error('[subscription-mp-webhook] failed payment sync failed:', subscriptionUpdateError.code);
      return;
    }
  }

  if (eventRowId) {
    await supabaseAdmin
      .from('mercadopago_subscription_events')
      .update({
        organization_id: subscription.organization_id,
        subscription_id: subscription.id,
        payment_id: payment?.id ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', eventRowId);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: webhookCorsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const isValid = await validateMpSignature(req);
  if (!isValid) {
    console.warn('[subscription-mp-webhook] invalid signature');
    return jsonResponse({ error: 'Invalid signature' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json() as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const supabaseAdmin = createAdminClient();
  const topic = eventTopic(payload);
  const action = payload.action as string | undefined;
  const dataId = payloadDataId(payload, req);

  const { data: eventRow, error: eventError } = await supabaseAdmin
    .from('mercadopago_subscription_events')
    .insert({
      topic,
      action: action ?? null,
      data_id: dataId,
      provider_event_id: payload.id ? String(payload.id) : null,
      payload,
    })
    .select('id')
    .maybeSingle();

  if (eventError) {
    console.warn('[subscription-mp-webhook] event log insert failed:', eventError);
  }

  try {
    if (dataId && isPreapprovalEvent(topic, action)) {
      await syncPreapproval(supabaseAdmin, dataId, eventRow?.id ?? null);
    } else if (dataId && isAuthorizedPaymentEvent(topic, action)) {
      await syncAuthorizedPayment(supabaseAdmin, dataId, eventRow?.id ?? null);
    }
  } catch (err) {
    console.error('[subscription-mp-webhook] sync error:', err);
  }

  return jsonResponse({ received: true });
});
