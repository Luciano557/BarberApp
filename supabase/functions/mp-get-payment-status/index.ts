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
    const { payment_intent_id } = await req.json() as { payment_intent_id: string };

    if (!payment_intent_id) {
      return jsonResponse({ error: 'payment_intent_id es requerido' }, 400);
    }

    const accessToken = await getAccessToken(supabaseAdmin, orgId);
    if (!accessToken) {
      return jsonResponse({ error: 'MercadoPago no está conectado' }, 404);
    }

    const mpRes = await mpFetch(
      `/point/integration-api/payment-intents/${payment_intent_id}`,
      accessToken,
    );

    if (!mpRes.ok) {
      if (mpRes.status === 404) {
        return jsonResponse({ status: 'NOT_FOUND' });
      }
      const errBody = await mpRes.text();
      console.warn('[mp-get-payment-status] MP error:', mpRes.status, errBody);
      return jsonResponse({ error: 'Error al consultar estado' }, 502);
    }

    const intent = await mpRes.json();
    // intent shape: {
    //   id, amount,
    //   state: { terminal_state: "OPEN" | "ON_TERMINAL" | "PROCESSING" | "FINISHED" },
    //   payment?: { id, status: "approved" | "rejected" | "cancelled" }
    // }
    const terminalState: string = intent?.state?.terminal_state ?? 'OPEN';
    const paymentStatus: string | undefined = intent?.payment?.status;
    const mpPaymentId: string | undefined = intent?.payment?.id
      ? String(intent.payment.id)
      : undefined;

    return jsonResponse({
      status: terminalState,
      payment_status: paymentStatus,
      mp_payment_id: mpPaymentId,
    });
  } catch (err) {
    console.error('[mp-get-payment-status] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
