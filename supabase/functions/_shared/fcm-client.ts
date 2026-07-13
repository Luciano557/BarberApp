/**
 * _shared/fcm-client.ts
 *
 * Shared Firebase Cloud Messaging (HTTP v1) helper. Signs a Google service
 * account JWT with Deno's native crypto.subtle (no external auth library),
 * exchanges it for an OAuth2 access token, and sends push messages.
 */

interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

interface CachedAccessToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // renovar 5 min antes de expirar

let cachedToken: CachedAccessToken | null = null;

function parseServiceAccount(): FirebaseServiceAccount {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  }

  let parsed: Partial<FirebaseServiceAccount>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing required fields');
  }

  return parsed as FirebaseServiceAccount;
}

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** Builds and signs a Google OAuth2 JWT-bearer assertion for the service account. */
async function createSignedJwt(account: FirebaseServiceAccount): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: account.client_email,
    scope: FCM_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const unsignedToken =
    `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;
  const privateKey = await importPrivateKey(account.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function exchangeJwtForAccessToken(
  jwt: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    console.error('[fcm-client] token exchange failed. status:', res.status);
    throw new Error(`Google OAuth token exchange failed with status ${res.status}`);
  }

  const json = await res.json();
  if (typeof json.access_token !== 'string') {
    throw new Error('Google OAuth token response missing access_token');
  }

  return { accessToken: json.access_token, expiresIn: (json.expires_in as number) ?? 3600 };
}

/**
 * Returns a valid FCM OAuth2 access token, reusing the cached one until
 * 5 minutes before it expires.
 */
export async function getFcmAccessToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS > now) {
    return cachedToken.accessToken;
  }

  const account = parseServiceAccount();
  const jwt = await createSignedJwt(account);
  const { accessToken, expiresIn } = await exchangeJwtForAccessToken(jwt);

  cachedToken = { accessToken, expiresAt: now + expiresIn * 1000 };
  return accessToken;
}

/** Safely reads FCM v1 error responses without leaking credentials. */
async function readFcmError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    const message = parsed?.error?.message;
    const status = parsed?.error?.status;
    if (typeof message === 'string') {
      return status ? `${status}: ${message}` : message;
    }
  } catch {
    // Respuesta no-JSON, se usa el fallback de abajo.
  }
  return `FCM request failed with status ${response.status}`;
}

/** Sends a single FCM push message. Never throws — failures come back in the result. */
export async function sendFcmMessage(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { project_id: projectId } = parseServiceAccount();
    const accessToken = await getFcmAccessToken();

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            ...(data ? { data } : {}),
          },
        }),
      },
    );

    if (!res.ok) {
      return { success: false, error: await readFcmError(res) };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending FCM message',
    };
  }
}
