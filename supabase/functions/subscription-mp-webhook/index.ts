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
    console.warn('[subscription-mp-webhook] preapproval fetch failed:', mpRes.status, mpError.payload);
    return;
  }

  const preapproval = await mpRes.json();
  const externalReference = preapproval.external_reference as string | undefined;

  const { data: subscription } = await supabaseAdmin
    .from('organization_subscriptions')
    .select('id, organization_id, status, current_plan_code, pending_plan_code, effective_plan_code, current_period_start, current_period_end')
    .or(`mercadopago_preapproval_id.eq.${preapprovalId},mercadopago_external_reference.eq.${externalReference ?? '__missing__'}`)
    .maybeSingle();

  if (!subscription) {
    console.warn('[subscription-mp-webhook] subscription not found for preapproval:', preapprovalId);
    return;
  }

  const nextStatus = mapSubscriptionStatus(preapproval.status as string | undefined, subscription.status);
  const nextPaymentDate = preapproval.next_payment_date
    ? new Date(preapproval.next_payment_date as string)
    : null;
  const periodStart = nextStatus === 'active'
    ? new Date()
    : subscription.current_period_start
      ? new Date(subscription.current_period_start)
      : new Date();
  const periodEnd = nextStatus === 'active'
    ? nextPaymentDate ?? addMonths(periodStart, 1)
    : subscription.current_period_end
      ? new Date(subscription.current_period_end)
      : null;
  const nextPlan =
    subscription.pending_plan_code ??
    subscription.current_plan_code ??
    subscription.effective_plan_code ??
    'basico';
  const subscriptionUpdate: Record<string, unknown> = {
    status: nextStatus,
    current_plan_code: nextStatus === 'active' ? nextPlan : subscription.current_plan_code,
    effective_plan_code: nextStatus === 'active' ? nextPlan : subscription.effective_plan_code,
    pending_plan_code: nextStatus === 'active' ? null : subscription.pending_plan_code,
    mercadopago_status: preapproval.status ?? null,
    mercadopago_init_point: preapproval.init_point ?? preapproval.sandbox_init_point ?? null,
    mercadopago_external_reference: externalReference ?? null,
    next_payment_date: nextPaymentDate?.toISOString() ?? null,
    current_period_start: nextStatus === 'active' ? periodStart.toISOString() : subscription.current_period_start,
    current_period_end: nextStatus === 'active' ? periodEnd?.toISOString() ?? null : subscription.current_period_end,
  };

  if (nextStatus === 'active') {
    subscriptionUpdate.billing_plan_code = nextPlan;
  }

  await supabaseAdmin
    .from('organization_subscriptions')
    .update(subscriptionUpdate)
    .eq('id', subscription.id);

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
    console.warn('[subscription-mp-webhook] authorized payment fetch failed:', mpRes.status, mpError.payload);
    return;
  }

  const authorizedPayment = await mpRes.json();
  const preapprovalId =
    authorizedPayment.preapproval_id ??
    authorizedPayment.subscription_id ??
    authorizedPayment.preapproval?.id;

  if (!preapprovalId) {
    console.warn('[subscription-mp-webhook] authorized payment without preapproval:', authorizedPayment);
    return;
  }

  const { data: subscription } = await supabaseAdmin
    .from('organization_subscriptions')
    .select('id, organization_id, current_plan_code, effective_plan_code, billing_plan_code, current_period_start, current_period_end')
    .eq('mercadopago_preapproval_id', String(preapprovalId))
    .maybeSingle();

  if (!subscription) {
    console.warn('[subscription-mp-webhook] subscription not found for authorized payment:', authorizedPaymentId);
    return;
  }

  const paymentStatus = mapPaymentStatus(authorizedPayment.status as string | undefined);
  const amount = Number(
    authorizedPayment.transaction_amount ??
    authorizedPayment.amount ??
    authorizedPayment.payment?.transaction_amount ??
    0,
  );
  const paidAt = paymentStatus === 'approved'
    ? new Date(
      authorizedPayment.date_approved ??
      authorizedPayment.last_modified ??
      authorizedPayment.date_created ??
      Date.now(),
    ).toISOString()
    : null;
  const planCode =
    subscription.billing_plan_code ??
    subscription.effective_plan_code ??
    subscription.current_plan_code ??
    'basico';

  const { data: payment } = await supabaseAdmin
    .from('subscription_payments')
    .upsert({
      organization_id: subscription.organization_id,
      subscription_id: subscription.id,
      plan_code: planCode,
      billing_plan_code: subscription.billing_plan_code ?? planCode,
      amount_ars: Number.isFinite(amount) ? amount : 0,
      currency_id: authorizedPayment.currency_id ?? 'ARS',
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

  if (paymentStatus === 'approved') {
    const nextPaymentDate = authorizedPayment.next_payment_date
      ? new Date(authorizedPayment.next_payment_date as string)
      : null;
    const periodStart = paidAt ? new Date(paidAt) : new Date();
    const periodEnd = nextPaymentDate ?? addMonths(periodStart, 1);

    await supabaseAdmin
      .from('organization_subscriptions')
      .update({
        status: 'active',
        current_plan_code: planCode,
        effective_plan_code: planCode,
        billing_plan_code: planCode,
        pending_plan_code: null,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        last_payment_at: paidAt,
      })
      .eq('id', subscription.id);
  } else if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
    await supabaseAdmin
      .from('organization_subscriptions')
      .update({
        status: 'past_due',
      })
      .eq('id', subscription.id);
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
