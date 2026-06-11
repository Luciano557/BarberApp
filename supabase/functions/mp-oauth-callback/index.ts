/**
 * mp-oauth-callback
 *
 * Handles the browser redirect from MercadoPago after the user authorizes the app.
 * Flow:
 *   1. Decode state param → orgId + orgSlug
 *   2. Exchange authorization code for access/refresh tokens via MP API
 *   3. Upsert tokens into mp_connections (service role)
 *   4. Redirect browser back to the app
 *
 * This function receives a GET request from a browser redirect, so it does NOT
 * use the standard Authorization header pattern.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MP_BASE } from '../_shared/mp-client.ts';

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const appOrigin = Deno.env.get('MERCADOPAGO_APP_ORIGIN') ?? 'http://localhost:5173';

  const redirectError = (msg: string, orgSlug?: string): Response => {
    const base = orgSlug ? `${appOrigin}/app/${orgSlug}` : appOrigin;
    return Response.redirect(`${base}?mp_error=${encodeURIComponent(msg)}`, 302);
  };

  if (errorParam) {
    return redirectError(decodeURIComponent(errorParam));
  }

  if (!code || !state) {
    return redirectError('Parámetros de autorización inválidos');
  }

  // Decode state: btoa(`${orgId}:${orgSlug}`)
  let orgId: string;
  let orgSlug: string;
  try {
    const decoded = atob(state);
    const colonIdx = decoded.indexOf(':');
    if (colonIdx < 1) throw new Error('bad state');
    orgId = decoded.slice(0, colonIdx);
    orgSlug = decoded.slice(colonIdx + 1);
    if (!orgId || !orgSlug) throw new Error('empty parts');
  } catch {
    return redirectError('Estado de autorización inválido');
  }

  const redirectSuccess = `${appOrigin}/app/${orgSlug}?mp_connected=true`;

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch(`${MP_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Deno.env.get('MERCADOPAGO_CLIENT_ID'),
        client_secret: Deno.env.get('MERCADOPAGO_CLIENT_SECRET'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: Deno.env.get('MERCADOPAGO_REDIRECT_URI'),
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('[mp-oauth-callback] token exchange failed:', tokenRes.status, body);
      return redirectError('No se pudo conectar con MercadoPago', orgSlug);
    }

    const token = await tokenRes.json();
    // token shape: { access_token, refresh_token, token_type, expires_in, scope, user_id }

    const expiresAt = new Date(
      Date.now() + ((token.expires_in as number) ?? 15552000) * 1000,
    ).toISOString();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Verify the organization actually exists before saving
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .maybeSingle();

    if (!org) {
      return redirectError('Organización no encontrada', orgSlug);
    }

    const { error: upsertError } = await supabaseAdmin
      .from('mp_connections')
      .upsert(
        {
          organization_id: orgId,
          mp_user_id: String(token.user_id),
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' },
      );

    if (upsertError) {
      console.error('[mp-oauth-callback] upsert error:', upsertError);
      return redirectError('Error al guardar la conexión', orgSlug);
    }

    return Response.redirect(redirectSuccess, 302);
  } catch (err) {
    console.error('[mp-oauth-callback] unexpected error:', err);
    return redirectError('Error inesperado al conectar', orgSlug);
  }
});
