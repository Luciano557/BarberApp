/**
 * mp-create-payment-intent
 *
 * Creates a MercadoPago Point payment intent on the specified terminal.
 * The terminal displays the charge and waits for the customer to tap/insert card.
 *
 * Body: { device_id: string, amount_cents: number, description?: string, external_reference?: string }
 * Response: { payment_intent_id: string }
 *
 * amount_cents must be in Argentine centavos (ARS × 100).
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
    const body = await req.json() as {
      device_id: string;
      amount_cents: number;
      description?: string;
      external_reference?: string;
    };

    if (!body.device_id || !body.amount_cents || body.amount_cents <= 0) {
      return jsonResponse({ error: 'device_id y amount_cents son requeridos' }, 400);
    }

    // Verify the device belongs to this organization
    const { data: device } = await supabaseAdmin
      .from('mp_devices')
      .select('mp_device_id, activo')
      .eq('mp_device_id', body.device_id)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!device || !device.activo) {
      return jsonResponse({ error: 'Terminal no encontrada o inactiva' }, 404);
    }

    const accessToken = await getAccessToken(supabaseAdmin, orgId);
    if (!accessToken) {
      return jsonResponse({ error: 'MercadoPago no está conectado' }, 404);
    }

    const intentBody = {
      amount: body.amount_cents,
      description: body.description ?? 'Cobro Vitro',
      ...(body.external_reference ? { external_reference: body.external_reference } : {}),
      payment: {
        installments: 1,
        type: 'credit_card', // Terminal accepts any type — this is just the intent config
      },
    };

    const mpRes = await mpFetch(
      `/point/integration-api/devices/${body.device_id}/payment-intents`,
      accessToken,
      { method: 'POST', body: JSON.stringify(intentBody) },
    );

    if (!mpRes.ok) {
      const errBody = await mpRes.text();
      console.error('[mp-create-payment-intent] MP error:', mpRes.status, errBody);
      return jsonResponse({ error: 'No se pudo enviar el cobro a la terminal' }, 502);
    }

    const intent = await mpRes.json();
    // intent shape: { id, amount, state: { worker_state: "WORKING" }, ... }

    return jsonResponse({ payment_intent_id: intent.id as string });
  } catch (err) {
    console.error('[mp-create-payment-intent] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
