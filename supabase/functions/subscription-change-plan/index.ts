/**
 * Changes the active subscription plan.
 *
 * Upgrade: requires a Mercado Pago checkout and is applied after payment confirmation.
 * Downgrade: stores pending_plan_code and applies after current_period_end.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  corsHeaders,
  jsonResponse,
  mpPlatformFetch,
  readMpError,
} from '../_shared/mp-client.ts';
import {
  getBillingContext,
  isBillingPlanCode,
} from '../_shared/subscription-billing.ts';

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

async function cancelPendingCheckout(preapprovalId: string): Promise<Response | null> {
  const currentResponse = await mpPlatformFetch(`/preapproval/${preapprovalId}`);
  if (currentResponse.status === 404) return null;

  if (!currentResponse.ok) {
    const providerError = await readMpError(currentResponse);
    console.warn('[subscription-change-plan] pending checkout verification failed:', currentResponse.status, providerError.code);
    return jsonResponse({ error: 'No pudimos verificar el checkout pendiente' }, 502);
  }

  const current = await currentResponse.json() as { status?: string };
  const status = current.status?.toLowerCase();
  if (status === 'cancelled' || status === 'canceled') return null;
  if (status !== 'pending') {
    return jsonResponse({
      error: 'El checkout pendiente cambio de estado. Actualiza la suscripcion antes de continuar.',
    }, 409);
  }

  const cancelResponse = await mpPlatformFetch(`/preapproval/${preapprovalId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  });

  if (!cancelResponse.ok) {
    const providerError = await readMpError(cancelResponse);
    console.warn('[subscription-change-plan] pending checkout cancellation failed:', cancelResponse.status, providerError.code);
    return jsonResponse({ error: 'No pudimos invalidar el checkout pendiente' }, 502);
  }

  return null;
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
    const body = await req.json() as { plan_code?: unknown };
    if (!isBillingPlanCode(body.plan_code)) {
      return jsonResponse({ error: 'plan_code invalido' }, 400);
    }

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('organization_subscriptions')
      .select('id, status, current_plan_code, effective_plan_code, pending_plan_code, billing_plan_code, current_period_start, current_period_end, mercadopago_preapproval_id, mercadopago_init_point, metadata')
      .eq('organization_id', context.organizationId)
      .maybeSingle();

    if (subscriptionError || !subscription) {
      return jsonResponse({ error: 'Suscripcion no encontrada' }, 404);
    }

    if (subscription.status !== 'active') {
      return jsonResponse({
        error: 'Para cambiar de plan primero se necesita una suscripcion activa',
        requires_checkout: true,
      }, 409);
    }

    const planCodes = [
      subscription.effective_plan_code,
      subscription.current_plan_code,
      body.plan_code,
    ].filter(Boolean);

    const { data: plans, error: plansError } = await supabaseAdmin
      .from('subscription_plans')
      .select('code, name, amount_ars, price_version, sort_order')
      .in('code', planCodes);

    if (plansError || !plans) {
      return jsonResponse({ error: 'No se pudieron cargar los planes' }, 500);
    }

    const planByCode = new Map(
      (plans as Array<{ code: string; name: string; amount_ars: number; price_version: number; sort_order: number }>)
        .map((plan) => [plan.code, plan]),
    );

    const fromPlanCode = subscription.effective_plan_code ?? subscription.current_plan_code;
    const fromPlan = fromPlanCode ? planByCode.get(fromPlanCode) : null;
    const toPlan = planByCode.get(body.plan_code);

    if (!toPlan) {
      return jsonResponse({ error: 'Plan no encontrado' }, 404);
    }

    if (fromPlan?.code === toPlan.code && !subscription.pending_plan_code) {
      return jsonResponse({ ok: true, unchanged: true });
    }

    if (!fromPlan) {
      return jsonResponse({
        error: 'No hay un plan activo para cambiar',
        requires_checkout: true,
      }, 409);
    }

    const isUpgrade = toPlan.sort_order > fromPlan.sort_order;
    const isDowngrade = toPlan.sort_order < fromPlan.sort_order;

    if (!isUpgrade && !isDowngrade) {
      return jsonResponse({ ok: true, unchanged: true });
    }

    if (isDowngrade) {
      const metadata = isRecord(subscription.metadata) ? subscription.metadata : {};
      const pendingPreapprovalId = typeof metadata.pending_mercadopago_preapproval_id === 'string'
        ? metadata.pending_mercadopago_preapproval_id
        : null;

      if (pendingPreapprovalId && pendingPreapprovalId !== subscription.mercadopago_preapproval_id) {
        const cancellationError = await cancelPendingCheckout(pendingPreapprovalId);
        if (cancellationError) return cancellationError;
      }

      const { error: updateError } = await supabaseAdmin
        .from('organization_subscriptions')
        .update({
          pending_plan_code: toPlan.code,
          pending_checkout_amount_ars: null,
          pending_checkout_price_version: null,
          mercadopago_init_point: null,
          metadata: withoutPendingCheckoutMetadata(metadata),
        })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('[subscription-change-plan] downgrade update error:', updateError);
        return jsonResponse({ error: 'No se pudo programar la baja de plan' }, 500);
      }

      await supabaseAdmin.from('subscription_plan_changes').insert({
        organization_id: context.organizationId,
        subscription_id: subscription.id,
        from_plan_code: fromPlan.code,
        to_plan_code: toPlan.code,
        change_type: 'downgrade',
        requested_by: context.userId,
        effective_at: subscription.current_period_end,
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end,
        amount_ars: Number(toPlan.amount_ars),
        metadata: {
          price_version: Number(toPlan.price_version),
        },
      });

      return jsonResponse({
        ok: true,
        change_type: 'downgrade',
        pending_plan_code: toPlan.code,
        effective_at: subscription.current_period_end,
      });
    }

    return jsonResponse({
      ok: true,
      change_type: 'upgrade',
      plan_code: toPlan.code,
      requires_checkout: true,
    });
  } catch (err) {
    console.error('[subscription-change-plan] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
