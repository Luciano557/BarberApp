import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mpPlatformFetch, readMpError } from '../_shared/mp-client.ts';
import {
  fetchAllRows,
  getPlatformAdminContext,
  getRequestId,
  insertAuditLog,
  isRecord,
  jsonError,
  jsonResponse,
  mapWithConcurrency,
  numberValue,
  platformAdminCorsHeaders,
  sanitizeMessage,
  stringValue,
} from '../_shared/platform-admin.ts';

type PriceAction = 'preview' | 'apply' | 'process' | 'retry';
type AuditResult = 'pending' | 'succeeded' | 'partial' | 'failed' | 'skipped';

interface PriceBody extends Record<string, unknown> {
  action?: unknown;
  planCode?: unknown;
  newAmountArs?: unknown;
  expectedAmountArs?: unknown;
  expectedPriceVersion?: unknown;
  expectedUpdatedAt?: unknown;
  reason?: unknown;
  password?: unknown;
  batchId?: unknown;
  itemIds?: unknown;
}

interface WorkItem extends Record<string, unknown> {
  id: string;
  batch_id: string;
  organization_id: string;
  subscription_id: string;
  preapproval_id: string | null;
  item_type: 'active_renewal' | 'pending_checkout';
  status: string;
  attempts: number;
  idempotency_key: string;
  claimed_at: string;
  plan_code: string;
  expected_external_reference?: string | null;
}

interface ProcessResult {
  itemId: string;
  succeeded: boolean;
  status: string;
}

interface RevalidatedTarget {
  current: boolean;
  expectedExternalReference: string | null;
}

type ProviderTargetCheck =
  | { kind: 'ok' }
  | { kind: 'skip'; code: string; message: string }
  | { kind: 'fail'; attempts: number; status: number | null; code: string; message: string };

const ACTIONS: readonly PriceAction[] = ['preview', 'apply', 'process', 'retry'];
const PLAN_CODES = ['basico', 'profesional', 'premium'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AMOUNT_ARS = 999_999_999.99;
const PROCESS_LIMIT = 20;
const PROCESS_CONCURRENCY = 5;
const MAX_PROVIDER_ATTEMPTS = 3;

function isPlanCode(value: unknown): value is typeof PLAN_CODES[number] {
  return typeof value === 'string' && PLAN_CODES.includes(value as typeof PLAN_CODES[number]);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function pendingCheckoutPreapprovalId(subscription: Record<string, unknown>): string | null {
  const metadata = isRecord(subscription.metadata) ? subscription.metadata : {};
  return stringValue(metadata.pending_mercadopago_preapproval_id) ?? (
    subscription.mercadopago_status === 'pending'
      ? stringValue(subscription.mercadopago_preapproval_id)
      : null
  );
}

function hasPendingCheckoutIntent(subscription: Record<string, unknown>): boolean {
  return Boolean(
    pendingCheckoutPreapprovalId(subscription) ||
    numberValue(subscription.pending_checkout_amount_ars) !== null ||
    numberValue(subscription.pending_checkout_price_version) !== null
  );
}

function currentBillingPlanCode(subscription: Record<string, unknown>): string | null {
  return stringValue(
    subscription.billing_plan_code ??
      subscription.current_plan_code ??
      subscription.effective_plan_code,
  );
}

function renewalTargetPlanCode(subscription: Record<string, unknown>): string | null {
  const scheduledPlan = !hasPendingCheckoutIntent(subscription)
    ? stringValue(subscription.pending_plan_code)
    : null;
  return scheduledPlan ?? currentBillingPlanCode(subscription);
}

function parseSubscriptionExternalReference(value: unknown): {
  organizationId: string;
  planCode: string;
} | null {
  const reference = stringValue(value);
  if (!reference) return null;
  const match = reference.match(
    /^sub_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})_(basico|profesional|premium)(?:_|$)/i,
  );
  return match ? { organizationId: match[1], planCode: match[2].toLowerCase() } : null;
}

function mutationsEnabled(): boolean {
  return Deno.env.get('PLATFORM_ADMIN_PRICE_MUTATIONS_ENABLED')?.trim().toLowerCase() === 'true';
}

function planDto(row: Record<string, unknown>): Record<string, unknown> {
  return {
    code: stringValue(row.code) ?? '',
    name: stringValue(row.name) ?? '',
    description: stringValue(row.description),
    amountArs: numberValue(row.amount_ars) ?? 0,
    priceVersion: numberValue(row.price_version) ?? 1,
    billingPeriod: stringValue(row.billing_period) ?? 'monthly',
    isActive: row.is_active === true,
    sortOrder: numberValue(row.sort_order) ?? 0,
    updatedAt: stringValue(row.updated_at) ?? '',
  };
}

function mappedBatchStatus(value: unknown): string {
  return value === 'partially_completed' ? 'partially_failed' : (stringValue(value) ?? 'failed');
}

function batchDto(
  row: Record<string, unknown>,
  itemRows: Record<string, unknown>[] = [],
): Record<string, unknown> {
  const pendingCount = itemRows.filter((item) => item.status === 'pending').length;
  const processingCount = itemRows.filter((item) => item.status === 'processing').length;
  const total = numberValue(row.total_items) ?? itemRows.length;
  const skipped = numberValue(row.skipped_items) ?? itemRows.filter((item) => item.status === 'skipped').length;
  const retryable = itemRows.filter((item) => (
    item.status === 'failed' ||
    (item.status === 'skipped' && item.error_code === 'missing_preapproval')
  )).length;

  return {
    id: stringValue(row.id) ?? '',
    planCode: stringValue(row.plan_code) ?? '',
    previousAmountArs: numberValue(row.old_amount_ars) ?? 0,
    nextAmountArs: numberValue(row.new_amount_ars) ?? 0,
    previousPriceVersion: numberValue(row.old_price_version) ?? 0,
    nextPriceVersion: numberValue(row.new_price_version) ?? 0,
    status: mappedBatchStatus(row.status),
    eligibleCount: Math.max(total - skipped, 0),
    pendingCount,
    processingCount,
    succeededCount: numberValue(row.succeeded_items) ?? 0,
    failedCount: numberValue(row.failed_items) ?? 0,
    skippedCount: skipped,
    retryableCount: retryable,
    actorUserId: stringValue(row.actor_user_id) ?? '',
    actorAlias: stringValue(row.actor_alias) ?? 'admin',
    reason: stringValue(row.reason) ?? '',
    createdAt: stringValue(row.created_at) ?? '',
    startedAt: stringValue(row.started_at),
    completedAt: stringValue(row.completed_at),
    updatedAt: stringValue(row.updated_at) ?? '',
  };
}

async function readBatch(
  supabaseAdmin: SupabaseClient,
  batchId: string,
): Promise<{ batch: Record<string, unknown>; items: Record<string, unknown>[] }> {
  const [{ data: batch, error: batchError }, { data: items, error: itemsError }] = await Promise.all([
    supabaseAdmin
      .from('subscription_price_change_batches')
      .select('id,plan_code,old_amount_ars,new_amount_ars,old_price_version,new_price_version,status,total_items,processed_items,succeeded_items,failed_items,skipped_items,actor_user_id,actor_alias,reason,started_at,completed_at,created_at,updated_at')
      .eq('id', batchId)
      .maybeSingle(),
    supabaseAdmin
      .from('subscription_price_change_items')
      .select('id,batch_id,status,claimed_at,next_retry_at')
      .eq('batch_id', batchId),
  ]);

  if (batchError || itemsError) throw new Error('BATCH_READ_FAILED');
  if (!batch) throw new Error('BATCH_NOT_FOUND');
  return {
    batch: batch as Record<string, unknown>,
    items: (items ?? []) as Record<string, unknown>[],
  };
}

async function assertBatchIsCurrent(
  supabaseAdmin: SupabaseClient,
  batch: Record<string, unknown>,
): Promise<boolean> {
  const { data: plan, error } = await supabaseAdmin
    .from('subscription_plans')
    .select('amount_ars,price_version')
    .eq('code', batch.plan_code)
    .maybeSingle();
  if (error || !plan) throw new Error('PLAN_READ_FAILED');
  return (
    numberValue(plan.amount_ars) === numberValue(batch.new_amount_ars) &&
    numberValue(plan.price_version) === numberValue(batch.new_price_version)
  );
}

async function preview(supabaseAdmin: SupabaseClient, body: PriceBody) {
  if (!isPlanCode(body.planCode)) throw new Error('INVALID_PLAN');

  const [{ data: plan, error: planError }, subscriptions] = await Promise.all([
    supabaseAdmin
      .from('subscription_plans')
      .select('code,name,description,amount_ars,price_version,billing_period,is_active,sort_order,updated_at')
      .eq('code', body.planCode)
      .maybeSingle(),
    fetchAllRows(
      supabaseAdmin,
      'organization_subscriptions',
      'id,status,provider,current_plan_code,effective_plan_code,billing_plan_code,pending_plan_code,pending_checkout_amount_ars,pending_checkout_price_version,mercadopago_preapproval_id,mercadopago_status,metadata',
    ),
  ]);
  if (planError) throw new Error('PLAN_READ_FAILED');
  if (!plan) throw new Error('PLAN_NOT_FOUND');

  let eligibleActiveRenewals = 0;
  let pendingCheckouts = 0;
  const exclusionCounts = new Map<string, number>();
  const exclude = (reason: string) => exclusionCounts.set(reason, (exclusionCounts.get(reason) ?? 0) + 1);

  for (const subscription of subscriptions) {
    const activePlan = renewalTargetPlanCode(subscription);
    if (subscription.status === 'active' && activePlan === body.planCode) {
      if (subscription.provider !== 'mercadopago') exclude('Proveedor no compatible');
      else if (!stringValue(subscription.mercadopago_preapproval_id)) exclude('Falta preapproval activo');
      else eligibleActiveRenewals += 1;
    }

    const pendingId = pendingCheckoutPreapprovalId(subscription);
    if (subscription.pending_plan_code === body.planCode && hasPendingCheckoutIntent(subscription)) {
      if (subscription.provider !== 'mercadopago') exclude('Checkout con proveedor no compatible');
      else if (!pendingId) exclude('Falta preapproval pendiente');
      else pendingCheckouts += 1;
    }
  }

  const exclusions = Array.from(exclusionCounts.entries()).map(([reason, count]) => ({ reason, count }));
  const excluded = exclusions.reduce((total, item) => total + item.count, 0);
  return {
    plan: planDto(plan as Record<string, unknown>),
    impact: {
      eligibleActiveRenewals,
      pendingCheckouts,
      excluded,
      totalAffected: eligibleActiveRenewals + pendingCheckouts,
    },
    exclusions,
  };
}

async function reauthenticatePassword(
  context: { userId: string; email: string },
  password: string,
): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!supabaseUrl || !anonKey) throw new Error('AUTH_CONFIGURATION_ERROR');

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: context.email,
    password,
  });

  return !error && data.user?.id === context.userId &&
    data.user.app_metadata?.platform_role === 'platform_admin';
}

async function applyPrice(
  supabaseAdmin: SupabaseClient,
  context: { userId: string; email: string },
  body: PriceBody,
  requestId: string,
) {
  if (!isPlanCode(body.planCode)) throw new Error('INVALID_PLAN');
  const newAmountArs = numberValue(body.newAmountArs);
  const expectedAmountArs = numberValue(body.expectedAmountArs);
  const expectedPriceVersion = numberValue(body.expectedPriceVersion);
  const expectedUpdatedAt = stringValue(body.expectedUpdatedAt);
  const reason = stringValue(body.reason);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!newAmountArs || newAmountArs <= 0 || newAmountArs > MAX_AMOUNT_ARS) {
    throw new Error('INVALID_PRICE');
  }
  if (expectedAmountArs === null || !Number.isInteger(expectedPriceVersion) || !expectedUpdatedAt) {
    throw new Error('INVALID_EXPECTED_CATALOG');
  }
  if (!Number.isFinite(Date.parse(expectedUpdatedAt))) throw new Error('INVALID_EXPECTED_CATALOG');
  if (!reason || reason.length < 10 || reason.length > 500) throw new Error('INVALID_REASON');
  if (!password || password.length > 1024) throw new Error('INVALID_PASSWORD');

  if (!(await reauthenticatePassword(context, password))) {
    throw new Error('PASSWORD_CONFIRMATION_FAILED');
  }

  const { data: createdBatch, error: createError } = await supabaseAdmin.rpc(
    'platform_admin_create_price_change_batch',
    {
      _plan_code: body.planCode,
      _new_amount_ars: newAmountArs,
      _expected_amount_ars: expectedAmountArs,
      _expected_price_version: expectedPriceVersion,
      _expected_updated_at: expectedUpdatedAt,
      _actor_user_id: context.userId,
      _reason: reason,
      _request_id: requestId,
    },
  );
  if (createError) {
    const message = `${createError.code ?? ''}:${createError.message ?? ''}`;
    if (message.includes('CATALOG_CONFLICT') || createError.code === '40001') {
      throw new Error('CATALOG_CONFLICT');
    }
    if (createError.code === '23505') throw new Error('UNFINISHED_BATCH_EXISTS');
    if (message.includes('PRICE_UNCHANGED')) throw new Error('PRICE_UNCHANGED');
    throw new Error('BATCH_CREATE_FAILED');
  }

  const batchId = stringValue(isRecord(createdBatch) ? createdBatch.id : null);
  if (!batchId) throw new Error('BATCH_CREATE_FAILED');

  const { error: refreshError } = await supabaseAdmin.rpc(
    'platform_admin_refresh_price_change_batch',
    { _batch_id: batchId },
  );
  if (refreshError) throw new Error('BATCH_REFRESH_FAILED');

  const [{ batch, items }, { data: plan, error: planError }] = await Promise.all([
    readBatch(supabaseAdmin, batchId),
    supabaseAdmin
      .from('subscription_plans')
      .select('code,name,description,amount_ars,price_version,billing_period,is_active,sort_order,updated_at')
      .eq('code', body.planCode)
      .single(),
  ]);
  if (planError || !plan) throw new Error('PLAN_READ_FAILED');

  return { batch: batchDto(batch, items), plan: planDto(plan as Record<string, unknown>) };
}

function transientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 1_500);
  return Math.min(250 * (2 ** Math.max(attempt - 1, 0)), 1_500);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function failItem(
  supabaseAdmin: SupabaseClient,
  item: WorkItem,
  attempts: number,
  status: number | null,
  code: string,
  message: string,
): Promise<ProcessResult> {
  let update = supabaseAdmin
    .from('subscription_price_change_items')
    .update({
      status: 'failed',
      attempts,
      last_http_status: status,
      error_code: code.slice(0, 120),
      error_message: sanitizeMessage(message),
      next_retry_at: null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', item.id)
    .eq('status', 'processing')
    .eq('idempotency_key', item.idempotency_key)
    .eq('claimed_at', item.claimed_at);
  update = item.preapproval_id
    ? update.eq('preapproval_id', item.preapproval_id)
    : update.is('preapproval_id', null);
  const { data, error } = await update.select('id').maybeSingle();
  if (error) throw new Error('ITEM_FAILURE_WRITE_FAILED');
  if (!data) return { itemId: item.id, succeeded: false, status: 'claim_lost' };
  return { itemId: item.id, succeeded: false, status: 'failed' };
}

async function skipItem(
  supabaseAdmin: SupabaseClient,
  item: WorkItem,
  code: string,
  message: string,
): Promise<ProcessResult> {
  let update = supabaseAdmin
    .from('subscription_price_change_items')
    .update({
      status: 'skipped',
      error_code: code.slice(0, 120),
      error_message: sanitizeMessage(message),
      next_retry_at: null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', item.id)
    .eq('status', 'processing')
    .eq('idempotency_key', item.idempotency_key)
    .eq('claimed_at', item.claimed_at);
  update = item.preapproval_id
    ? update.eq('preapproval_id', item.preapproval_id)
    : update.is('preapproval_id', null);
  const { data, error } = await update.select('id').maybeSingle();
  if (error) throw new Error('ITEM_SKIP_WRITE_FAILED');
  if (!data) return { itemId: item.id, succeeded: false, status: 'claim_lost' };
  return { itemId: item.id, succeeded: false, status: 'skipped' };
}

async function workItemStillCurrent(
  supabaseAdmin: SupabaseClient,
  item: WorkItem,
): Promise<RevalidatedTarget> {
  const { data: subscription, error } = await supabaseAdmin
    .from('organization_subscriptions')
    .select('status,provider,current_plan_code,effective_plan_code,billing_plan_code,pending_plan_code,pending_checkout_amount_ars,pending_checkout_price_version,mercadopago_preapproval_id,mercadopago_external_reference,mercadopago_status,metadata')
    .eq('id', item.subscription_id)
    .maybeSingle();
  if (error) throw new Error('SUBSCRIPTION_REVALIDATION_FAILED');
  if (!subscription || subscription.provider !== 'mercadopago') {
    return { current: false, expectedExternalReference: null };
  }

  if (item.item_type === 'active_renewal') {
    const planCode = renewalTargetPlanCode(subscription as Record<string, unknown>);
    return {
      current: subscription.status === 'active' &&
        planCode === item.plan_code &&
        stringValue(subscription.mercadopago_preapproval_id) === item.preapproval_id,
      expectedExternalReference: stringValue(subscription.mercadopago_external_reference),
    };
  }

  const metadata = isRecord(subscription.metadata) ? subscription.metadata : {};
  return {
    current: subscription.pending_plan_code === item.plan_code &&
      pendingCheckoutPreapprovalId(subscription as Record<string, unknown>) === item.preapproval_id,
    expectedExternalReference:
      stringValue(metadata.pending_mercadopago_external_reference) ??
      (subscription.mercadopago_status === 'pending'
        ? stringValue(subscription.mercadopago_external_reference)
        : null),
  };
}

async function verifyProviderTarget(item: WorkItem): Promise<ProviderTargetCheck> {
  let lastStatus: number | null = null;
  let lastCode = 'provider_verification_failed';
  let lastMessage = 'No se pudo verificar el preapproval antes de actualizarlo.';

  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    try {
      const response = await mpPlatformFetch(
        `/preapproval/${encodeURIComponent(item.preapproval_id ?? '')}`,
      );
      lastStatus = response.status;
      if (!response.ok) {
        const providerError = await readMpError(response);
        lastCode = sanitizeMessage(providerError.code, 'provider_verification_failed').slice(0, 120);
        lastMessage = sanitizeMessage(providerError.message, lastMessage);
        if (transientStatus(response.status) && attempt < MAX_PROVIDER_ATTEMPTS) {
          await wait(retryDelay(response, attempt));
          continue;
        }
        return { kind: 'fail', attempts: attempt, status: response.status, code: lastCode, message: lastMessage };
      }

      const payload = await response.json() as Record<string, unknown>;
      const autoRecurring = isRecord(payload.auto_recurring) ? payload.auto_recurring : {};
      const providerReference = stringValue(payload.external_reference);
      const parsedReference = parseSubscriptionExternalReference(providerReference);
      const providerStatus = stringValue(payload.status)?.toLowerCase();
      const expectedStatus = item.item_type === 'pending_checkout' ? 'pending' : 'authorized';

      if (
        String(payload.id ?? '') !== item.preapproval_id ||
        !parsedReference ||
        parsedReference.organizationId.toLowerCase() !== item.organization_id.toLowerCase() ||
        !item.expected_external_reference ||
        providerReference !== item.expected_external_reference
      ) {
        return {
          kind: 'skip',
          code: 'provider_ownership_mismatch',
          message: 'El preapproval no pertenece a la organizacion y plan esperados.',
        };
      }

      if (providerStatus !== expectedStatus) {
        return {
          kind: 'skip',
          code: 'provider_status_changed',
          message: 'El preapproval cambio de estado antes de actualizar el precio.',
        };
      }
      if (stringValue(autoRecurring.currency_id) !== 'ARS') {
        return {
          kind: 'skip',
          code: 'provider_currency_mismatch',
          message: 'La moneda del preapproval no coincide con ARS.',
        };
      }

      return { kind: 'ok' };
    } catch (error) {
      lastCode = 'provider_network_error';
      lastMessage = sanitizeMessage(error);
      if (attempt < MAX_PROVIDER_ATTEMPTS) {
        await wait(Math.min(250 * (2 ** Math.max(attempt - 1, 0)), 1_500));
        continue;
      }
      return { kind: 'fail', attempts: attempt, status: lastStatus, code: lastCode, message: lastMessage };
    }
  }

  return {
    kind: 'fail',
    attempts: MAX_PROVIDER_ATTEMPTS,
    status: lastStatus,
    code: lastCode,
    message: lastMessage,
  };
}

async function compensateProviderAfterLocalChange(
  supabaseAdmin: SupabaseClient,
  item: WorkItem,
): Promise<boolean> {
  const { data: subscription, error } = await supabaseAdmin
    .from('organization_subscriptions')
    .select('status,provider,billing_amount_ars,pending_plan_code,pending_checkout_amount_ars,pending_checkout_price_version,mercadopago_preapproval_id,mercadopago_status,metadata')
    .eq('id', item.subscription_id)
    .maybeSingle();
  if (error) return false;

  let desiredAmount: number | null = null;
  if (subscription?.provider === 'mercadopago') {
    const subscriptionRow = subscription as Record<string, unknown>;
    if (
      item.item_type === 'active_renewal' &&
      stringValue(subscription.mercadopago_preapproval_id) === item.preapproval_id
    ) {
      const metadata = isRecord(subscription.metadata) ? subscription.metadata : {};
      const isScheduledRenewal = Boolean(
        stringValue(subscription.pending_plan_code) &&
        !hasPendingCheckoutIntent(subscriptionRow),
      );
      desiredAmount = isScheduledRenewal
        ? numberValue(metadata.scheduled_renewal_amount_ars)
        : numberValue(subscription.billing_amount_ars);
    } else if (
      item.item_type === 'pending_checkout' &&
      pendingCheckoutPreapprovalId(subscriptionRow) === item.preapproval_id
    ) {
      desiredAmount = numberValue(subscription.pending_checkout_amount_ars);
    }
  }

  let providerPayload: Record<string, unknown> | null = null;
  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    const response = await mpPlatformFetch(
      `/preapproval/${encodeURIComponent(item.preapproval_id ?? '')}`,
    );
    if (response.status === 404) return true;
    if (response.ok) {
      providerPayload = await response.json() as Record<string, unknown>;
      break;
    }
    if (!transientStatus(response.status) || attempt >= MAX_PROVIDER_ATTEMPTS) return false;
    await wait(retryDelay(response, attempt));
  }
  if (!providerPayload) return false;

  const parsedReference = parseSubscriptionExternalReference(providerPayload.external_reference);
  if (
    String(providerPayload.id ?? '') !== item.preapproval_id ||
    !parsedReference ||
    parsedReference.organizationId.toLowerCase() !== item.organization_id.toLowerCase()
  ) {
    return false;
  }

  const providerStatus = stringValue(providerPayload.status)?.toLowerCase();
  if (!desiredAmount || desiredAmount <= 0) {
    if (providerStatus === 'cancelled' || providerStatus === 'canceled') return true;
  }

  const idempotencyKey = crypto.randomUUID();
  const body = desiredAmount && desiredAmount > 0
    ? {
      auto_recurring: {
        transaction_amount: desiredAmount,
        currency_id: 'ARS',
      },
    }
    : { status: 'cancelled' };

  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    const response = await mpPlatformFetch(
      `/preapproval/${encodeURIComponent(item.preapproval_id ?? '')}`,
      {
        method: 'PUT',
        headers: { 'X-Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      },
    );
    if (response.ok || response.status === 404) return true;
    if (!transientStatus(response.status) || attempt >= MAX_PROVIDER_ATTEMPTS) return false;
    await wait(retryDelay(response, attempt));
  }
  return false;
}

async function processItem(
  supabaseAdmin: SupabaseClient,
  item: WorkItem,
): Promise<ProcessResult> {
  const localTarget = await workItemStillCurrent(supabaseAdmin, item);
  if (!localTarget.current) {
    return skipItem(
      supabaseAdmin,
      item,
      'subscription_changed',
      'La suscripcion o su preapproval cambiaron antes del procesamiento.',
    );
  }
  item.expected_external_reference = localTarget.expectedExternalReference;

  if (!item.preapproval_id) {
    return failItem(
      supabaseAdmin,
      item,
      Math.min(item.attempts + 1, MAX_PROVIDER_ATTEMPTS),
      null,
      'missing_preapproval',
      'Falta la referencia de preapproval.',
    );
  }

  const providerTarget = await verifyProviderTarget(item);
  if (providerTarget.kind === 'skip') {
    return skipItem(supabaseAdmin, item, providerTarget.code, providerTarget.message);
  }
  if (providerTarget.kind === 'fail') {
    return failItem(
      supabaseAdmin,
      item,
      Math.min(item.attempts + providerTarget.attempts, MAX_PROVIDER_ATTEMPTS),
      providerTarget.status,
      providerTarget.code,
      providerTarget.message,
    );
  }

  let attempts = Math.max(item.attempts, 0);
  let lastStatus: number | null = null;
  let lastCode = 'provider_request_failed';
  let lastMessage = 'Mercado Pago no pudo actualizar la suscripcion.';

  while (attempts < MAX_PROVIDER_ATTEMPTS) {
    attempts += 1;
    try {
      const response = await mpPlatformFetch(
        `/preapproval/${encodeURIComponent(item.preapproval_id)}`,
        {
          method: 'PUT',
          headers: { 'X-Idempotency-Key': item.idempotency_key },
          body: JSON.stringify({
            auto_recurring: {
              transaction_amount: numberValue(item.new_amount_ars),
              currency_id: 'ARS',
            },
          }),
        },
      );
      lastStatus = response.status;

      if (response.ok) {
        let providerReference: string | null = null;
        try {
          const payload = await response.json();
          providerReference = isRecord(payload) ? stringValue(payload.id) : null;
        } catch {
          // A successful response does not require a JSON body.
        }

        const { data: completion, error } = await supabaseAdmin.rpc(
          'platform_admin_complete_price_change_item',
          {
            _item_id: item.id,
            _expected_idempotency_key: item.idempotency_key,
            _expected_preapproval_id: item.preapproval_id,
            _expected_claimed_at: item.claimed_at,
            _attempts: attempts,
            _http_status: response.status,
            _provider_response_ref: providerReference,
          },
        );
        if (error) {
          if (error.code === '40001' || error.message?.includes('ITEM_CLAIM_LOST')) {
            return { itemId: item.id, succeeded: false, status: 'claim_lost' };
          }
          throw new Error('ITEM_COMPLETION_WRITE_FAILED');
        }
        if (isRecord(completion) && completion.status === 'compensation_required') {
          const compensated = await compensateProviderAfterLocalChange(supabaseAdmin, item);
          return compensated
            ? skipItem(
              supabaseAdmin,
              item,
              'subscription_changed_compensated',
              'La suscripcion cambio; se restauro el estado vigente en Mercado Pago.',
            )
            : failItem(
              supabaseAdmin,
              item,
              attempts,
              response.status,
              'provider_compensation_failed',
              'La suscripcion cambio y no se pudo restaurar Mercado Pago automaticamente.',
            );
        }
        return { itemId: item.id, succeeded: true, status: 'succeeded' };
      }

      const providerError = await readMpError(response);
      lastCode = sanitizeMessage(providerError.code, 'provider_error').slice(0, 120);
      lastMessage = sanitizeMessage(providerError.message, 'Mercado Pago rechazo la actualizacion.');
      if (!transientStatus(response.status) || attempts >= MAX_PROVIDER_ATTEMPTS) break;
      await wait(retryDelay(response, attempts));
    } catch (error) {
      const message = sanitizeMessage(error);
      if (message === 'ITEM_COMPLETION_WRITE_FAILED') throw error;
      lastCode = 'provider_network_error';
      lastMessage = message;
      if (attempts >= MAX_PROVIDER_ATTEMPTS) break;
      await wait(Math.min(250 * (2 ** Math.max(attempts - 1, 0)), 1_500));
    }
  }

  return failItem(supabaseAdmin, item, attempts, lastStatus, lastCode, lastMessage);
}

async function processBatch(
  supabaseAdmin: SupabaseClient,
  context: { userId: string },
  batchId: string,
  requestId: string,
) {
  const before = await readBatch(supabaseAdmin, batchId);
  if (!(await assertBatchIsCurrent(supabaseAdmin, before.batch))) {
    throw new Error('STALE_BATCH');
  }

  const { data: claimed, error: claimError } = await supabaseAdmin.rpc(
    'platform_admin_claim_price_change_items',
    { _batch_id: batchId, _limit: PROCESS_LIMIT },
  );
  if (claimError) throw new Error('BATCH_CLAIM_FAILED');

  const batchAmount = numberValue(before.batch.new_amount_ars);
  const workItems = ((claimed ?? []) as Record<string, unknown>[]).map((row) => ({
    ...row,
    id: String(row.id),
    batch_id: String(row.batch_id),
    organization_id: String(row.organization_id),
    subscription_id: String(row.subscription_id),
    preapproval_id: stringValue(row.preapproval_id),
    item_type: row.item_type === 'pending_checkout' ? 'pending_checkout' : 'active_renewal',
    status: stringValue(row.status) ?? 'processing',
    attempts: numberValue(row.attempts) ?? 0,
    idempotency_key: String(row.idempotency_key),
    claimed_at: String(row.claimed_at),
    plan_code: stringValue(before.batch.plan_code) ?? '',
    new_amount_ars: batchAmount,
  } satisfies WorkItem));

  const results = await mapWithConcurrency(
    workItems,
    PROCESS_CONCURRENCY,
    async (item) => {
      try {
        return await processItem(supabaseAdmin, item);
      } catch (error) {
        console.error(`[platform-admin-price-change] ${requestId}: ${sanitizeMessage(error)}`);
        return failItem(
          supabaseAdmin,
          item,
          Math.min(item.attempts + 1, MAX_PROVIDER_ATTEMPTS),
          null,
          'internal_processing_error',
          'No se pudo confirmar el resultado local.',
        );
      }
    },
  );

  const { error: refreshError } = await supabaseAdmin.rpc(
    'platform_admin_refresh_price_change_batch',
    { _batch_id: batchId },
  );
  if (refreshError) throw new Error('BATCH_REFRESH_FAILED');

  const after = await readBatch(supabaseAdmin, batchId);
  // A concurrent worker may still own `processing` rows. Only advertise work
  // this caller can claim now, otherwise clients can spin in a tight loop.
  const hasMore = after.items.some((item) => item.status === 'pending');
  const succeeded = results.filter((result) => result.succeeded).length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;
  const claimLost = results.filter((result) => result.status === 'claim_lost').length;
  const resultStatus: AuditResult = claimLost > 0
    ? (succeeded > 0 || failed > 0 || skipped > 0 ? 'partial' : 'pending')
    : failed > 0
      ? (succeeded > 0 || skipped > 0 ? 'partial' : 'failed')
      : skipped > 0
        ? 'partial'
        : 'succeeded';

  await insertAuditLog(supabaseAdmin, {
    actorUserId: context.userId,
    action: 'subscription_price_change.processed',
    targetType: 'subscription_price_change_batch',
    targetId: batchId,
    resultStatus,
    resultDetail: {
      batchId,
      processed: results.length,
      succeeded,
      failed,
      skipped,
      claimLost,
    },
    requestId,
  });

  return {
    batch: batchDto(after.batch, after.items),
    processed: results.length,
    hasMore,
  };
}

async function retryBatch(
  supabaseAdmin: SupabaseClient,
  context: { userId: string },
  body: PriceBody,
  requestId: string,
) {
  if (!isUuid(body.batchId)) throw new Error('INVALID_BATCH_ID');
  const itemIds = body.itemIds === undefined
    ? null
    : Array.isArray(body.itemIds) && body.itemIds.length <= 50 && body.itemIds.every(isUuid)
      ? body.itemIds
      : undefined;
  if (itemIds === undefined) throw new Error('INVALID_ITEM_IDS');

  const before = await readBatch(supabaseAdmin, body.batchId);
  if (!(await assertBatchIsCurrent(supabaseAdmin, before.batch))) throw new Error('STALE_BATCH');

  const { data: reopened, error } = await supabaseAdmin.rpc(
    'platform_admin_retry_price_change_items',
    { _batch_id: body.batchId, _item_ids: itemIds },
  );
  if (error) throw new Error('BATCH_RETRY_FAILED');

  const { error: refreshError } = await supabaseAdmin.rpc(
    'platform_admin_refresh_price_change_batch',
    { _batch_id: body.batchId },
  );
  if (refreshError) throw new Error('BATCH_REFRESH_FAILED');

  const after = await readBatch(supabaseAdmin, body.batchId);
  await insertAuditLog(supabaseAdmin, {
    actorUserId: context.userId,
    action: 'subscription_price_change.retried',
    targetType: 'subscription_price_change_batch',
    targetId: body.batchId,
    resultStatus: 'pending',
    resultDetail: { batchId: body.batchId, processed: numberValue(reopened) ?? 0 },
    requestId,
  });

  return {
    batch: batchDto(after.batch, after.items),
    reopened: numberValue(reopened) ?? 0,
  };
}

function mutationErrorResponse(req: Request, error: unknown, requestId: string): Response {
  const code = sanitizeMessage(error);
  switch (code) {
    case 'INVALID_PLAN':
    case 'PLAN_NOT_FOUND':
      return jsonError(req, 'Plan invalido.', 400, code, requestId);
    case 'INVALID_PRICE':
      return jsonError(req, 'El importe debe ser un valor ARS positivo.', 400, code, requestId);
    case 'INVALID_REASON':
      return jsonError(req, 'El motivo debe tener entre 10 y 500 caracteres.', 400, code, requestId);
    case 'INVALID_EXPECTED_CATALOG':
    case 'INVALID_BATCH_ID':
    case 'INVALID_ITEM_IDS':
      return jsonError(req, 'Datos de confirmacion invalidos.', 400, code, requestId);
    case 'INVALID_PASSWORD':
    case 'PASSWORD_CONFIRMATION_FAILED':
      return jsonError(req, 'No se pudo confirmar la contrasena.', 400, code, requestId);
    case 'CATALOG_CONFLICT':
    case 'UNFINISHED_BATCH_EXISTS':
    case 'STALE_BATCH':
    case 'PRICE_UNCHANGED':
      return jsonError(req, 'El catalogo cambio o tiene un lote sin resolver. Actualiza antes de continuar.', 409, code, requestId);
    case 'BATCH_NOT_FOUND':
      return jsonError(req, 'Lote no encontrado.', 404, code, requestId);
    default:
      console.error(`[platform-admin-price-change] ${requestId}: ${code}`);
      return jsonError(req, 'No se pudo completar la operacion de precios.', 500, 'PRICE_CHANGE_FAILED', requestId);
  }
}

serve(async (req: Request): Promise<Response> => {
  const requestId = getRequestId(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: platformAdminCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonError(req, 'Metodo no permitido.', 405, 'METHOD_NOT_ALLOWED', requestId);
  }

  const auth = await getPlatformAdminContext(req, requestId);
  if (auth.error) return auth.error;

  let body: PriceBody;
  try {
    body = await req.json() as PriceBody;
  } catch {
    return jsonError(req, 'JSON invalido.', 400, 'INVALID_JSON', requestId);
  }
  if (typeof body.action !== 'string' || !ACTIONS.includes(body.action as PriceAction)) {
    return jsonError(req, 'Accion invalida.', 400, 'INVALID_ACTION', requestId);
  }

  if (body.action !== 'preview' && !mutationsEnabled()) {
    return jsonError(
      req,
      'Las mutaciones de precios estan temporalmente deshabilitadas.',
      503,
      'MUTATIONS_DISABLED',
      requestId,
    );
  }

  try {
    let data: unknown;
    switch (body.action as PriceAction) {
      case 'preview':
        data = await preview(auth.supabaseAdmin!, body);
        break;
      case 'apply':
        data = await applyPrice(auth.supabaseAdmin!, auth.context!, body, requestId);
        break;
      case 'process':
        if (!isUuid(body.batchId)) throw new Error('INVALID_BATCH_ID');
        data = await processBatch(auth.supabaseAdmin!, auth.context!, body.batchId, requestId);
        break;
      case 'retry':
        data = await retryBatch(auth.supabaseAdmin!, auth.context!, body, requestId);
        break;
    }

    return jsonResponse(
      req,
      { ...(isRecord(data) ? data : { data }), requestId },
      200,
      requestId,
    );
  } catch (error) {
    return mutationErrorResponse(req, error, requestId);
  }
});
