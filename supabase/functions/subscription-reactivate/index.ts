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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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
      .select('id, status, current_plan_code, effective_plan_code, billing_plan_code, current_period_start, current_period_end, mercadopago_preapproval_id, metadata')
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

    if (!subscription.mercadopago_preapproval_id || !planCode) {
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
      .select('amount_ars, price_version')
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

    const mpRes = await mpPlatformFetch(`/preapproval/${subscription.mercadopago_preapproval_id}`, {
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

    const { error: updateError } = await supabaseAdmin
      .from('organization_subscriptions')
      .update({
        status: 'active',
        cancel_at_period_end: false,
        cancelled_at: null,
        pending_plan_code: null,
        billing_plan_code: planCode,
        billing_amount_ars: amount,
        billing_price_version: priceVersion,
        pending_checkout_amount_ars: null,
        pending_checkout_price_version: null,
        mercadopago_status: 'authorized',
        mercadopago_init_point: null,
        metadata: withoutPendingCheckoutMetadata(subscription.metadata),
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('[subscription-reactivate] update error:', updateError);
      return jsonResponse({ error: 'No se pudo reactivar la suscripcion local' }, 500);
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
