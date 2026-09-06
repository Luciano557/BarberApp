/**
 * Attempts to reactivate a cancelled subscription.
 * If Mercado Pago cannot reactivate it, the client should create a new checkout.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  corsHeaders,
  jsonResponse,
  mpPlatformFetch,
  readMpError,
} from '../_shared/mp-client.ts';
import { getBillingContext } from '../_shared/subscription-billing.ts';
import { reconcileOwnedPreapproval } from '../_shared/subscription-reconciliation.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseSubscriptionExternalReference(value: unknown): {
  organizationId: string;
  planCode: string;
} | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^sub_([0-9a-fA-F-]{36})_(basico|profesional|premium)_/);
  return match ? { organizationId: match[1], planCode: match[2] } : null;
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
  delete metadata.scheduled_renewal_amount_ars;
  delete metadata.scheduled_renewal_price_version;
  return metadata;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const { supabaseAdmin, context, error } = await getBillingContext(req);
  if (error) return error;

  try {
    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('organization_subscriptions')
      .select('id, status, provider, current_plan_code, effective_plan_code, billing_plan_code, billing_amount_ars, billing_price_version, current_period_start, current_period_end, mercadopago_preapproval_id, mercadopago_external_reference, metadata, updated_at')
      .eq('organization_id', context.organizationId)
      .maybeSingle();

    if (subscriptionError || !subscription) {
      return jsonResponse({ error: 'Suscripcion no encontrada' }, 404);
    }

    if (subscription.status === 'active') {
      return jsonResponse({ ok: true, already_active: true });
    }

    const planCode =
      subscription.current_plan_code ??
      subscription.billing_plan_code ??
      subscription.effective_plan_code ??
      null;

    if (
      subscription.provider !== 'mercadopago' ||
      !subscription.mercadopago_preapproval_id ||
      !planCode
    ) {
      return jsonResponse({
        ok: false,
        requires_checkout: true,
        plan_code: planCode,
      }, 409);
    }

    const hasCurrentPaidAccess = Boolean(
      subscription.current_period_end &&
      Number.isFinite(Date.parse(subscription.current_period_end)) &&
      Date.parse(subscription.current_period_end) > Date.now(),
    );
    if (subscription.status !== 'cancelled' || !hasCurrentPaidAccess) {
      return jsonResponse({
        ok: false,
        requires_checkout: true,
        plan_code: planCode,
      }, 409);
    }


    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('amount_ars, price_version, updated_at')
      .eq('code', planCode)
      .eq('is_active', true)
      .maybeSingle();

    const amount = Number(plan?.amount_ars);
    const priceVersion = Number(plan?.price_version);
    if (
      planError ||
      !plan ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isInteger(priceVersion) ||
      priceVersion < 1
    ) {
      return jsonResponse({
        ok: false,
        requires_checkout: true,
        plan_code: planCode,
      }, 409);
    }

    const providerLookup = await mpPlatformFetch(
      `/preapproval/${encodeURIComponent(subscription.mercadopago_preapproval_id)}`,
    );
    if (!providerLookup.ok) {
      const providerError = await readMpError(providerLookup);
      console.warn('[subscription-reactivate] MP verification failed:', providerLookup.status, providerError.code);
      return jsonResponse({
        ok: false,
        requires_checkout: true,
        plan_code: planCode,
      }, 409);
    }
    const providerPreapproval = await providerLookup.json() as Record<string, unknown>;
    const parsedReference = parseSubscriptionExternalReference(providerPreapproval.external_reference);
    if (
      String(providerPreapproval.id ?? '') !== subscription.mercadopago_preapproval_id ||
      !parsedReference ||
      parsedReference.organizationId !== context.organizationId ||
      !subscription.mercadopago_external_reference ||
      providerPreapproval.external_reference !== subscription.mercadopago_external_reference
    ) {
      console.error('[subscription-reactivate] preapproval ownership mismatch');
      return jsonResponse({ error: 'La referencia de Mercado Pago no coincide con la suscripcion' }, 409);
    }

    const mpRes = await mpPlatformFetch(`/preapproval/${encodeURIComponent(subscription.mercadopago_preapproval_id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'authorized',
        auto_recurring: {
          transaction_amount: amount,
          currency_id: 'ARS',
        },
      }),
    });

    if (!mpRes.ok) {
      const mpError = await readMpError(mpRes);
      console.warn('[subscription-reactivate] MP could not reactivate:', mpRes.status, mpError.code);
      return jsonResponse({
        ok: false,
        requires_checkout: true,
        plan_code: planCode,
        code: mpError.code,
      }, 409);
    }

    const { data: updatedSubscription, error: updateError } = await supabaseAdmin.rpc(
      'subscription_finalize_reactivation',
      {
        _organization_id: context.organizationId,
        _subscription_id: subscription.id,
        _expected_subscription_updated_at: subscription.updated_at,
        _expected_preapproval_id: subscription.mercadopago_preapproval_id,
        _plan_code: planCode,
        _expected_amount_ars: amount,
        _expected_price_version: priceVersion,
        _expected_plan_updated_at: plan.updated_at,
        _metadata: withoutPendingCheckoutMetadata(subscription.metadata),
      },
    );

    if (updateError || !updatedSubscription) {
      const compensated = await reconcileOwnedPreapproval(supabaseAdmin, {
        organizationId: context.organizationId,
        preapprovalId: subscription.mercadopago_preapproval_id,
        expectedExternalReference: subscription.mercadopago_external_reference,
        logPrefix: 'subscription-reactivate',
      });
      const conflict = updateError?.code === '40001' ||
        updateError?.message?.includes('CATALOG_CONFLICT') ||
        updateError?.message?.includes('SUBSCRIPTION_CONFLICT');
      console.error('[subscription-reactivate] finalize error:', updateError?.code ?? 'empty_result');
      return jsonResponse({
        error: conflict && compensated
          ? 'El precio o la suscripcion cambiaron durante la reactivacion. Actualiza y reintenta.'
          : 'No se pudo reactivar y Mercado Pago requiere conciliacion.',
      }, conflict && compensated ? 409 : 502);
    }

    await supabaseAdmin.from('subscription_plan_changes').insert({
      organization_id: context.organizationId,
      subscription_id: subscription.id,
      from_plan_code: planCode,
      to_plan_code: planCode,
      change_type: 'reactivation',
      requested_by: context.userId,
      effective_at: new Date().toISOString(),
      period_start: subscription.current_period_start,
      period_end: subscription.current_period_end,
      metadata: {
        mercadopago_preapproval_id: subscription.mercadopago_preapproval_id,
        amount_ars: amount,
        price_version: priceVersion,
      },
    });

    return jsonResponse({ ok: true, status: 'active', plan_code: planCode });
  } catch (err) {
    console.error('[subscription-reactivate] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
