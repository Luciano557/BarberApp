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
import { getAccessToken, mpFetch, corsHeaders, jsonResponse } from '../_shared/mp-client.ts';

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
    const { device_id, payment_intent_id } = await req.json() as {
      device_id: string;
      payment_intent_id: string;
    };

    if (!device_id || !payment_intent_id) {
      return jsonResponse({ error: 'device_id y payment_intent_id son requeridos' }, 400);
    }

    const accessToken = await getAccessToken(supabaseAdmin, orgId);
    if (!accessToken) {
      return jsonResponse({ error: 'MercadoPago no está conectado' }, 404);
    }

    const mpRes = await mpFetch(
      `/point/integration-api/devices/${device_id}/payment-intents/${payment_intent_id}`,
      accessToken,
      { method: 'DELETE' },
    );

    // 200 or 404 (already gone) are both acceptable outcomes
    if (!mpRes.ok && mpRes.status !== 404) {
      const errBody = await mpRes.text();
      console.warn('[mp-cancel-payment-intent] MP error:', mpRes.status, errBody);
      // Don't propagate — cancellation failure is non-critical for the UX
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[mp-cancel-payment-intent] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
