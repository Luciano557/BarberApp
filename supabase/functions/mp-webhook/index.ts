/**
 * mp-webhook
 *
 * Receives asynchronous payment notifications from MercadoPago.
 * Validates the x-signature header, logs the event, and updates venta.mp_status
 * for any venta that has a matching mp_payment_intent_id.
 *
 * Must be registered as the webhook URL in the MP developer portal.
 * This endpoint is PUBLIC (no Authorization header from MP).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Validates the x-signature header sent by MercadoPago.
 * See: https://developers.mercadopago.com/en/docs/your-integrations/notifications/webhooks#validate-origin
 */
async function validateMpSignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
  if (!secret) {
    // No secret configured — skip validation (only safe in dev/test environments)
    console.warn('[mp-webhook] MERCADOPAGO_WEBHOOK_SECRET not configured, skipping signature validation');
    return true;
  }

  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');
  if (!xSignature || !xRequestId) return false;

  // Parse the signature: ts=... ,v1=...
  const parts = Object.fromEntries(
    xSignature.split(',').map((part) => {
      const [k, v] = part.split('=');
      return [k.trim(), v.trim()];
    }),
  );

  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  // Build the signed manifest: ts;xRequestId;rawBody
  const url = new URL(req.url);
  const dataId = url.searchParams.get('data.id') ?? '';
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(manifest);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const computed = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computed === v1;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const rawBody = await req.text();

  const isValid = await validateMpSignature(req, rawBody);
  if (!isValid) {
    console.warn('[mp-webhook] invalid signature');
    return jsonResponse({ error: 'Invalid signature' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // MP sends: { action: "payment.updated", data: { id: "12345" }, type: "payment", ... }
  const action = payload.action as string | undefined;
  const type = payload.type as string | undefined;
  const dataId = (payload.data as Record<string, unknown>)?.id as string | undefined;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Log the event regardless of type (for audit/debugging)
  await supabaseAdmin.from('mp_webhook_log').insert({
    payment_intent_id: null, // Will be correlated below if found
    mp_payment_id: dataId ?? null,
    event_type: action ?? type ?? 'unknown',
    payload,
  });

  // We only process point.integration_api events (PDV payment intents)
  // These arrive with type = "point_integration_ipn" or action = "payment.updated"
  if (dataId && (type === 'point_integration_ipn' || action?.startsWith('payment'))) {
    // Look for a venta with this mp_payment_intent or mp_payment_id
    // MP sends the payment_intent_id as data.id for point integration events
    const { data: ventaRows } = await supabaseAdmin
      .from('venta')
      .select('id, mp_payment_intent_id, mp_status')
      .or(`mp_payment_intent_id.eq.${dataId}`)
      .limit(1);

    const venta = ventaRows?.[0];
    if (venta && venta.mp_status !== 'approved') {
      // Map MP payment status to our status
      const newStatus = payload.status as string | undefined;
      const mappedStatus = newStatus === 'approved' ? 'approved'
        : newStatus === 'rejected' ? 'rejected'
        : newStatus === 'cancelled' ? 'cancelled'
        : undefined;

      if (mappedStatus) {
        await supabaseAdmin
          .from('venta')
          .update({ mp_status: mappedStatus })
          .eq('id', venta.id);
      }
    }
  }

  // Always respond 200 to MP to acknowledge receipt
  return jsonResponse({ received: true });
});
