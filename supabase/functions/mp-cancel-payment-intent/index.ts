/**
 * mp-cancel-payment-intent
 *
 * Cancels a pending MercadoPago Point payment intent.
 * Should be called when the cashier aborts the payment or the UI times out.
 *
 * Body: { device_id: string, payment_intent_id: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getAccessToken,
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
    const { payment_intent_id } = await req.json() as {
      payment_intent_id: string;
    };

    if (!payment_intent_id) {
      return jsonResponse({ error: 'payment_intent_id es requerido' }, 400);
    }

    const accessToken = await getAccessToken(supabaseAdmin, orgId);
    if (!accessToken) {
      return jsonResponse({ error: 'MercadoPago no está conectado' }, 404);
    }

    const mpRes = await mpFetch(
      `/v1/orders/${encodeURIComponent(payment_intent_id)}/cancel`,
      accessToken,
      {
        method: 'POST',
        headers: { 'x-allow-cancelable-status': 'at_terminal' },
      },
    );

    // Missing/already-cancelled orders are acceptable for this best-effort cleanup.
    if (!mpRes.ok && mpRes.status !== 404) {
      const mpError = await readMpError(mpRes);
      if (mpError.code !== 'order_already_canceled') {
        console.warn('[mp-cancel-payment-intent] MP error:', mpRes.status, mpError.payload);
      }
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[mp-cancel-payment-intent] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
