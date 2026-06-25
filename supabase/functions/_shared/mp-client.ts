/**
 * _shared/mp-client.ts
 *
 * Shared MercadoPago API helper imported by all MP-related edge functions.
 * Handles token retrieval (with auto-refresh) and authenticated fetch.
 */

export const MP_BASE = 'https://api.mercadopago.com';

interface MpConnectionRow {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface SupabaseQueryLike extends PromiseLike<unknown> {
  select(columns: string): SupabaseQueryLike;
  update(values: Record<string, unknown>): SupabaseQueryLike;
  eq(column: string, value: unknown): SupabaseQueryLike;
  maybeSingle(): Promise<{ data: MpConnectionRow | null }>;
}

interface SupabaseAdminLike {
  from(table: string): SupabaseQueryLike;
}

/**
 * Access token for Vittro's own Mercado Pago seller account.
 * This is different from the per-organization OAuth token used for Point.
 */
export function getPlatformAccessToken(): string | null {
  const token = (
    Deno.env.get('MERCADOPAGO_SUBSCRIPTIONS_ACCESS_TOKEN') ||
    Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ||
    Deno.env.get('MP_ACCESS_TOKEN')
  );

  return token?.trim() || null;
}

/**
 * Retrieves a valid (refreshed if necessary) access token for the given org.
 * Returns null if the org has no MP connection.
 */
export async function getAccessToken(
  supabaseAdmin: SupabaseAdminLike,
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
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Content-Type', 'application/json');

  if (method !== 'GET' && method !== 'HEAD' && !headers.has('X-Idempotency-Key')) {
    headers.set('X-Idempotency-Key', crypto.randomUUID());
  }

  return fetch(`${MP_BASE}${path}`, {
    ...options,
    headers,
  });
}

/** Authenticated fetch using Vittro's own Mercado Pago account. */
export async function mpPlatformFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const accessToken = getPlatformAccessToken();

  if (!accessToken) {
    throw new Error('MERCADOPAGO_SUBSCRIPTIONS_ACCESS_TOKEN is not configured');
  }

  return mpFetch(path, accessToken, options);
}

export interface MpApiError {
  code: string | null;
  message: string | null;
  payload: unknown;
}

/** Safely reads Mercado Pago error responses without leaking credentials. */
export async function readMpError(response: Response): Promise<MpApiError> {
  const text = await response.text();
  let payload: unknown = text;

  try {
    payload = JSON.parse(text);
  } catch {
    // Keep non-JSON responses as plain text.
  }

  if (!payload || typeof payload !== 'object') {
    return {
      code: null,
      message: typeof payload === 'string' && payload.trim() ? payload : null,
      payload,
    };
  }

  const record = payload as Record<string, unknown>;
  const cause = Array.isArray(record.cause) ? record.cause[0] : null;
  const causeRecord = cause && typeof cause === 'object'
    ? cause as Record<string, unknown>
    : null;
  const firstError = Array.isArray(record.errors) ? record.errors[0] : null;
  const errorRecord = firstError && typeof firstError === 'object'
    ? firstError as Record<string, unknown>
    : null;

  const codeCandidate = record.code ?? record.error ?? errorRecord?.code ?? causeRecord?.code;
  const messageCandidate =
    record.message ??
    record.error_description ??
    errorRecord?.message ??
    errorRecord?.details ??
    causeRecord?.description ??
    causeRecord?.message;

  return {
    code: typeof codeCandidate === 'string' ? codeCandidate : null,
    message: typeof messageCandidate === 'string' ? messageCandidate : null,
    payload,
  };
}

/** Converts common Point/Orders API failures into actionable Spanish messages. */
export function mpErrorMessage(
  error: MpApiError,
  status: number,
  fallback: string,
): string {
  switch (error.code) {
    case 'already_queued_order_for_terminal':
      return 'La terminal ya tiene un cobro pendiente. Finalizalo o cancelalo antes de enviar otro.';
    case 'forbidden_checking_terminal_owner':
      return 'La terminal no pertenece a la cuenta de Mercado Pago conectada.';
    case 'terminal_not_allowed_action':
      return 'La terminal no admite cobros integrados. Configurala en modo PDV.';
    case 'store_pos_not_found':
      return 'La terminal no tiene una sucursal o caja configurada en Mercado Pago.';
    case 'required_properties':
    case 'minimum_properties':
    case 'minimum_items':
    case 'maximum_items':
    case 'property_value':
    case 'property_type':
    case 'json_syntax_error':
    case 'invalid_payload':
    case 'unsupported_properties':
      return error.message
        ? `Mercado Pago rechazó los datos del cobro: ${error.message}`
        : 'Mercado Pago rechazó los datos del cobro.';
    case 'unauthorized':
      return 'La conexión con Mercado Pago venció. Volvé a conectar la cuenta.';
    default:
      if (status === 401) {
        return 'La conexión con Mercado Pago venció. Volvé a conectar la cuenta.';
      }
      return error.message ? `${fallback}: ${error.message}` : fallback;
  }
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
