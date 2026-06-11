/**
 * _shared/mp-client.ts
 *
 * Shared MercadoPago API helper imported by all MP-related edge functions.
 * Handles token retrieval (with auto-refresh) and authenticated fetch.
 */

export const MP_BASE = 'https://api.mercadopago.com';

/**
 * Retrieves a valid (refreshed if necessary) access token for the given org.
 * Returns null if the org has no MP connection.
 */
export async function getAccessToken(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  orgId: string,
): Promise<string | null> {
  const { data: conn } = await supabaseAdmin
    .from('mp_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!conn) return null;

  const BUFFER_MS = 5 * 60 * 1000; // 5-minute buffer before expiry
  const expiresAt = new Date(conn.expires_at);

  if (expiresAt.getTime() > Date.now() + BUFFER_MS) {
    // Token is still valid
    return conn.access_token as string;
  }

  // Token expired or about to expire — attempt refresh
  try {
    const res = await fetch(`${MP_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Deno.env.get('MERCADOPAGO_CLIENT_ID'),
        client_secret: Deno.env.get('MERCADOPAGO_CLIENT_SECRET'),
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
      }),
    });

    if (!res.ok) {
      console.warn('[mp-client] refresh failed, returning stale token. status:', res.status);
      return conn.access_token as string;
    }

    const newToken = await res.json();
    const newExpiresAt = new Date(
      Date.now() + ((newToken.expires_in as number) ?? 15552000) * 1000,
    ).toISOString();

    await supabaseAdmin
      .from('mp_connections')
      .update({
        access_token: newToken.access_token,
        refresh_token: newToken.refresh_token ?? conn.refresh_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', orgId);

    return newToken.access_token as string;
  } catch (err) {
    console.error('[mp-client] refresh error:', err);
    return conn.access_token as string; // Return stale token as fallback
  }
}

/** Authenticated fetch against the MP REST API. */
export async function mpFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${MP_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
      ...(options.headers ?? {}),
    },
  });
}

/** Standard CORS headers for all MP edge functions. */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** JSON response helper. */
export function jsonResponse(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}
