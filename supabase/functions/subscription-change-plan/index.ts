/**
 * Changes the active subscription plan.
 *
 * Upgrade: applies immediately and updates the Mercado Pago recurring amount.
 * Downgrade: stores pending_plan_code and applies after current_period_end.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  corsHeaders,
  jsonResponse,
  mpErrorMessage,
  mpPlatformFetch,
  readMpError,
} from '../_shared/mp-client.ts';
import {
  getBillingContext,
  isBillingPlanCode,
} from '../_shared/subscription-billing.ts';

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
      .select('id, status, current_plan_code, effective_plan_code, pending_plan_code, billing_plan_code, current_period_start, current_period_end, mercadopago_preapproval_id')
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
      .select('code, name, amount_ars, sort_order')
      .in('code', planCodes);

    if (plansError || !plans) {
      return jsonResponse({ error: 'No se pudieron cargar los planes' }, 500);
    }

    const planByCode = new Map(
      (plans as Array<{ code: string; name: string; amount_ars: number; sort_order: number }>)
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
      const { error: updateError } = await supabaseAdmin
        .from('organization_subscriptions')
        .update({
          pending_plan_code: toPlan.code,
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
      });

      return jsonResponse({
        ok: true,
        change_type: 'downgrade',
        pending_plan_code: toPlan.code,
        effective_at: subscription.current_period_end,
      });
    }

    if (!subscription.mercadopago_preapproval_id) {
      return jsonResponse({
        error: 'La suscripcion no tiene una referencia de Mercado Pago',
        requires_checkout: true,
      }, 409);
    }

    const mpRes = await mpPlatformFetch(`/preapproval/${subscription.mercadopago_preapproval_id}`, {
      method: 'PUT',
      body: JSON.stringify({
        reason: `Vittro - Plan ${toPlan.name}`,
        auto_recurring: {
          transaction_amount: Number(toPlan.amount_ars),
          currency_id: 'ARS',
        },
      }),
    });

    if (!mpRes.ok) {
      const mpError = await readMpError(mpRes);
      console.error('[subscription-change-plan] MP error:', mpRes.status, mpError.payload);
      return jsonResponse({
        error: mpErrorMessage(mpError, mpRes.status, 'No se pudo actualizar el plan en Mercado Pago'),
        code: mpError.code,
      }, mpRes.status >= 500 ? 502 : 422);
    }

    const { error: updateError } = await supabaseAdmin
      .from('organization_subscriptions')
      .update({
        current_plan_code: toPlan.code,
        effective_plan_code: toPlan.code,
        billing_plan_code: toPlan.code,
        pending_plan_code: null,
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('[subscription-change-plan] upgrade update error:', updateError);
      return jsonResponse({ error: 'No se pudo actualizar la suscripcion local' }, 500);
    }

    await supabaseAdmin.from('subscription_plan_changes').insert({
      organization_id: context.organizationId,
      subscription_id: subscription.id,
      from_plan_code: fromPlan.code,
      to_plan_code: toPlan.code,
      change_type: 'upgrade',
      requested_by: context.userId,
      effective_at: new Date().toISOString(),
      period_start: subscription.current_period_start,
      period_end: subscription.current_period_end,
      amount_ars: Number(toPlan.amount_ars),
      metadata: {
        mercadopago_preapproval_id: subscription.mercadopago_preapproval_id,
      },
    });

    return jsonResponse({
      ok: true,
      change_type: 'upgrade',
      effective_plan_code: toPlan.code,
    });
  } catch (err) {
    console.error('[subscription-change-plan] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
