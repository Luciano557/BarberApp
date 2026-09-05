import {
  createClient,
  type SupabaseClient,
  type User,
} from 'https://esm.sh/@supabase/supabase-js@2';

export const PLATFORM_ADMIN_ROLE = 'platform_admin';
export const MAX_PAGE_SIZE = 50;
export const DB_FETCH_PAGE_SIZE = 1000;

export interface PlatformAdminContext {
  userId: string;
  email: string;
  alias: 'admin';
}

export interface PlatformAdminAuthResult {
  context?: PlatformAdminContext;
  supabaseAdmin?: SupabaseClient;
  error?: Response;
}

export function isPlatformAdminIdentity(
  user: Pick<User, 'email' | 'email_confirmed_at' | 'banned_until' | 'app_metadata'> | null | undefined,
): boolean {
  return Boolean(
    user?.email &&
    user.email_confirmed_at &&
    !isFutureDate(user.banned_until) &&
    user.app_metadata?.platform_role === PLATFORM_ADMIN_ROLE,
  );
}

export interface PageRequest {
  page: number;
  pageSize: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SortRequest {
  field: string;
  direction: SortDirection;
}

function configuredAllowedOrigins(): Set<string> {
  const configured = [
    Deno.env.get('APP_ORIGIN'),
    Deno.env.get('MERCADOPAGO_APP_ORIGIN'),
    ...(Deno.env.get('PLATFORM_ADMIN_ALLOWED_ORIGINS') ?? '').split(','),
  ]
    .map((value) => value?.trim().replace(/\/$/, ''))
    .filter((value): value is string => Boolean(value));

  return new Set(configured);
}

function responseOrigin(req: Request): string {
  const origin = req.headers.get('origin')?.replace(/\/$/, '');
  if (!origin) return '*';

  const allowed = configuredAllowedOrigins();
  if (allowed.has(origin)) return origin;

  try {
    const url = new URL(origin);
    if (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      (url.protocol === 'http:' || url.protocol === 'https:')
    ) {
      return origin;
    }
  } catch {
    // An invalid Origin never receives a permissive CORS header.
  }

  return 'null';
}

export function platformAdminCorsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': responseOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  requestId?: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...platformAdminCorsHeaders(req),
      'Content-Type': 'application/json',
      ...(requestId ? { 'X-Request-Id': requestId } : {}),
    },
  });
}

export function jsonError(
  req: Request,
  message: string,
  status: number,
  code: string,
  requestId?: string,
): Response {
  return jsonResponse(req, { error: message, code, requestId }, status, requestId);
}

export function getRequestId(req: Request): string {
  const supplied = req.headers.get('x-request-id')?.trim();
  if (
    supplied &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied)
  ) {
    return supplied;
  }
  return crypto.randomUUID();
}

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get('authorization')?.trim();
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isFutureDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

/**
 * Authenticates with the anon client first. The service-role client is not
 * created until the Auth server has returned the current user, the account is
 * active, and current app_metadata contains platform_admin.
 */
export async function getPlatformAdminContext(
  req: Request,
  requestId = getRequestId(req),
): Promise<PlatformAdminAuthResult> {
  const token = bearerToken(req);
  if (!token) {
    return {
      error: jsonError(req, 'No autenticado.', 401, 'UNAUTHORIZED', requestId),
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!supabaseUrl || !anonKey) {
    return {
      error: jsonError(req, 'Configuracion de autenticacion incompleta.', 500, 'AUTH_CONFIGURATION_ERROR', requestId),
    };
  }

  const verificationClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await verificationClient.auth.getUser(token);
  if (userError || !user) {
    return {
      error: jsonError(req, 'Sesion administrativa invalida.', 401, 'UNAUTHORIZED', requestId),
    };
  }

  if (
    !user.email ||
    !user.email_confirmed_at ||
    isFutureDate(user.banned_until)
  ) {
    return {
      error: jsonError(req, 'Cuenta administrativa inactiva.', 403, 'ADMIN_ACCOUNT_INACTIVE', requestId),
    };
  }

  if (!isPlatformAdminIdentity(user)) {
    return {
      error: jsonError(req, 'Permisos insuficientes.', 403, 'FORBIDDEN', requestId),
    };
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!serviceRoleKey) {
    return {
      error: jsonError(req, 'Configuracion administrativa incompleta.', 500, 'ADMIN_CONFIGURATION_ERROR', requestId),
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    supabaseAdmin,
    context: {
      userId: user.id,
      email: user.email,
      alias: 'admin',
    },
  };
}

export function parsePageRequest(value: Record<string, unknown>): PageRequest {
  const requestedPage = Number(value.page ?? 1);
  const requestedPageSize = Number(value.pageSize ?? 25);

  return {
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize: Number.isInteger(requestedPageSize)
      ? Math.min(Math.max(requestedPageSize, 1), MAX_PAGE_SIZE)
      : 25,
  };
}

export function parseSortRequest(
  value: unknown,
  allowedFields: readonly string[],
  fallbackField: string,
  fallbackDirection: SortDirection = 'desc',
): SortRequest {
  const sort = isRecord(value) ? value : {};
  const field = typeof sort.field === 'string' && allowedFields.includes(sort.field)
    ? sort.field
    : fallbackField;
  const direction = sort.direction === 'asc' || sort.direction === 'desc'
    ? sort.direction
    : fallbackDirection;

  return { field, direction };
}

export function paginate<T>(items: T[], pageRequest: PageRequest): {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
} {
  const offset = (pageRequest.page - 1) * pageRequest.pageSize;
  return {
    items: items.slice(offset, offset + pageRequest.pageSize),
    page: pageRequest.page,
    pageSize: pageRequest.pageSize,
    total: items.length,
  };
}

export function sortItems<T>(
  items: T[],
  field: keyof T,
  direction: SortDirection,
): T[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftValue = left[field];
    const rightValue = right[field];
    if (leftValue === rightValue) return 0;
    if (leftValue === null || leftValue === undefined) return 1;
    if (rightValue === null || rightValue === undefined) return -1;
    return String(leftValue).localeCompare(String(rightValue), 'es', {
      numeric: true,
      sensitivity: 'base',
    }) * multiplier;
  });
}

export async function fetchAllRows(
  supabaseAdmin: SupabaseClient,
  table: string,
  columns: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];

  for (let page = 0; page < 10_000; page += 1) {
    const from = page * DB_FETCH_PAGE_SIZE;
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(columns)
      .range(from, from + DB_FETCH_PAGE_SIZE - 1);

    if (error) throw new Error(`DATABASE_READ_FAILED:${table}`);
    const nextRows = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...nextRows);
    if (nextRows.length < DB_FETCH_PAGE_SIZE) return rows;
  }

  throw new Error(`DATABASE_PAGE_LIMIT_EXCEEDED:${table}`);
}

export async function listAllAuthUsers(
  supabaseAdmin: SupabaseClient,
): Promise<User[]> {
  const users: User[] = [];

  for (let page = 1; page <= 10_000; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: DB_FETCH_PAGE_SIZE,
    });
    if (error) throw new Error('AUTH_USERS_READ_FAILED');

    users.push(...data.users);
    if (data.users.length < DB_FETCH_PAGE_SIZE) return users;
  }

  throw new Error('AUTH_USERS_PAGE_LIMIT_EXCEEDED');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return null;
  }
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function maskReference(value: unknown): string | null {
  const reference = stringValue(value);
  if (!reference) return null;
  const suffix = reference.slice(-6);
  return `${'*'.repeat(Math.min(Math.max(reference.length - suffix.length, 4), 12))}${suffix}`;
}

export function hasSubscriptionAccess(
  status: unknown,
  trialEndsAt: unknown,
  currentPeriodEnd: unknown,
  now = Date.now(),
): boolean {
  const trialEnd = typeof trialEndsAt === 'string' ? Date.parse(trialEndsAt) : Number.NaN;
  const periodEnd = typeof currentPeriodEnd === 'string' ? Date.parse(currentPeriodEnd) : Number.NaN;

  if (status === 'trialing') return Number.isFinite(trialEnd) && trialEnd > now;
  if (status === 'active' || status === 'cancelled') {
    return Number.isFinite(periodEnd) && periodEnd > now;
  }
  return false;
}

export function sanitizeMessage(value: unknown, fallback = 'Error externo'): string {
  const raw = value instanceof Error
    ? value.message
    : typeof value === 'string'
      ? value
      : fallback;

  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
    .replace(/(?:access|refresh|api|secret)[_-]?token\s*[:=]\s*[^\s,;]+/gi, 'token=[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500);
}

export async function insertAuditLog(
  supabaseAdmin: SupabaseClient,
  input: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    reason?: string | null;
    previousState?: Record<string, unknown>;
    nextState?: Record<string, unknown>;
    resultStatus: 'pending' | 'succeeded' | 'partial' | 'failed' | 'skipped';
    resultDetail?: Record<string, unknown>;
    requestId: string;
  },
): Promise<void> {
  const { error } = await supabaseAdmin.from('platform_admin_audit_log').insert({
    actor_user_id: input.actorUserId,
    actor_alias: 'admin',
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    reason: input.reason?.trim().slice(0, 500) ?? null,
    previous_state: input.previousState ?? {},
    next_state: input.nextState ?? {},
    result_status: input.resultStatus,
    result_detail: input.resultDetail ?? {},
    request_id: input.requestId,
  });

  if (error && error.code !== '23505') {
    throw new Error('AUDIT_WRITE_FAILED');
  }
}

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(concurrency, 1), values.length) }, () => worker()),
  );

  return results;
}
