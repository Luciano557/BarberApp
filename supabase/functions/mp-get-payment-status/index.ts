/**
 * mp-get-payment-status
 *
 * Polls the status of a MercadoPago Point payment intent.
 * Called by the frontend every 3 seconds while waiting for terminal confirmation.
 *
 * Body: { payment_intent_id: string }
 * Response: { status: 'OPEN' | 'ON_TERMINAL' | 'PROCESSING' | 'FINISHED', payment_status?: string }
 *
 * When state = 'FINISHED':
 *   payment_status = 'approved' | 'rejected' | 'cancelled' | 'error'
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getAccessToken,
  mpErrorMessage,
  mpFetch,
  readMpError,
  corsHeaders,
  jsonResponse,
} from '../_shared/mp-client.ts';

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.organization_id) {
    return jsonResponse({ error: 'No organization' }, 400);
  }

  const orgId = profile.organization_id as string;

  try {
    const { payment_intent_id } = await req.json() as { payment_intent_id: string };

    if (!payment_intent_id) {
      return jsonResponse({ error: 'payment_intent_id es requerido' }, 400);
    }

    const accessToken = await getAccessToken(supabaseAdmin, orgId);
    if (!accessToken) {
      return jsonResponse({ error: 'MercadoPago no está conectado' }, 404);
    }

    const mpRes = await mpFetch(
      `/v1/orders/${encodeURIComponent(payment_intent_id)}`,
      accessToken,
    );

    if (!mpRes.ok) {
      if (mpRes.status === 404) {
        return jsonResponse({ status: 'NOT_FOUND' });
      }
      const mpError = await readMpError(mpRes);
      console.warn('[mp-get-payment-status] MP error:', mpRes.status, mpError.payload);
      return jsonResponse({
        error: mpErrorMessage(mpError, mpRes.status, 'Error al consultar el estado del cobro'),
        code: mpError.code,
      }, mpRes.status >= 500 ? 502 : 422);
    }

    const order = await mpRes.json();
    const orderStatus: string = order?.status ?? 'created';
    const payment = order?.transactions?.payments?.[0];
    const paymentStatus: string | undefined =
      orderStatus === 'processed' ? 'approved'
        : orderStatus === 'failed' ? 'rejected'
        : orderStatus === 'canceled' || orderStatus === 'expired' ? 'cancelled'
        : payment?.status;
    const mpPaymentId: string | undefined = payment?.id
      ? String(payment.id)
      : undefined;

    return jsonResponse({
      status: orderStatus,
      status_detail: order?.status_detail ?? payment?.status_detail,
      payment_status: paymentStatus,
      mp_payment_id: mpPaymentId,
    });
  } catch (err) {
    console.error('[mp-get-payment-status] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
