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
    const body = await req.json() as {
      device_id: string;
      amount_cents: number;
      description?: string;
      external_reference?: string;
    };

    if (
      !body.device_id ||
      !Number.isInteger(body.amount_cents) ||
      body.amount_cents <= 0
    ) {
      return jsonResponse({ error: 'device_id y amount_cents son requeridos' }, 400);
    }

    // Verify the device belongs to this organization
    const { data: device } = await supabaseAdmin
      .from('mp_devices')
      .select('mp_device_id, activo, operating_mode')
      .eq('mp_device_id', body.device_id)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!device || !device.activo) {
      return jsonResponse({ error: 'Terminal no encontrada o inactiva' }, 404);
    }

    if (device.operating_mode !== 'PDV') {
      return jsonResponse({
        error: 'La terminal debe estar configurada en modo PDV para recibir cobros.',
      }, 409);
    }

    const accessToken = await getAccessToken(supabaseAdmin, orgId);
    if (!accessToken) {
      return jsonResponse({ error: 'MercadoPago no está conectado' }, 404);
    }

    const requestedReference = body.external_reference
      ?.replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 64);
    const externalReference = requestedReference ||
      `vittro_${Date.now()}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;

    const orderBody = {
      type: 'point',
      external_reference: externalReference,
      description: (body.description?.trim() || 'Cobro Vittro').slice(0, 150),
      expiration_time: 'PT2M',
      transactions: {
        payments: [
          {
            amount: (body.amount_cents / 100).toFixed(2),
          },
        ],
      },
      config: {
        point: {
          terminal_id: body.device_id,
          print_on_terminal: 'no_ticket',
        },
      },
    };

    const mpRes = await mpFetch(
      '/v1/orders',
      accessToken,
      { method: 'POST', body: JSON.stringify(orderBody) },
    );

    if (!mpRes.ok) {
      const mpError = await readMpError(mpRes);
      console.error('[mp-create-payment-intent] MP error:', mpRes.status, mpError.payload);
      return jsonResponse({
        error: mpErrorMessage(mpError, mpRes.status, 'No se pudo enviar el cobro a la terminal'),
        code: mpError.code,
      }, mpRes.status >= 500 ? 502 : 422);
    }

    const order = await mpRes.json();

    // Keep payment_intent_id for compatibility with the current frontend/database contract.
    return jsonResponse({
      payment_intent_id: order.id as string,
      order_id: order.id as string,
    });
  } catch (err) {
    console.error('[mp-create-payment-intent] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
