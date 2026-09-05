import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  booleanValue,
  fetchAllRows,
  getPlatformAdminContext,
  getRequestId,
  isRecord,
  jsonError,
  jsonResponse,
  listAllAuthUsers,
  maskReference,
  numberValue,
  paginate,
  parsePageRequest,
  parseSortRequest,
  platformAdminCorsHeaders,
  sanitizeMessage,
  sortItems,
  stringValue,
} from '../_shared/platform-admin.ts';

type QueryOperation =
  | 'overview'
  | 'organizations'
  | 'users'
  | 'subscriptions'
  | 'payments'
  | 'audit'
  | 'price_change_status';

interface QueryBody extends Record<string, unknown> {
  operation?: unknown;
  search?: unknown;
  filters?: unknown;
  sort?: unknown;
}

interface OrganizationDto extends Record<string, unknown> {
  id: string;
  name: string;
  slug: string | null;
  isEnabled: boolean;
  createdAt: string;
  accessStatus: string;
  planCode: string | null;
  planName: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  billingAmountArs: number | null;
  branchesCount: number;
  usersCount: number;
  mau30: number;
  lastPaymentAt: string | null;
}

interface UserDto extends Record<string, unknown> {
  id: string;
  fullName: string | null;
  email: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  roles: string[];
  createdAt: string | null;
  lastSignInAt: string | null;
  isMau30: boolean;
  status: 'active' | 'inactive' | 'invited' | 'disabled';
}

interface SubscriptionDto extends Record<string, unknown> {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string | null;
  status: string;
  provider: string;
  effectivePlanCode: string;
  pendingPlanCode: string | null;
  billingPlanCode: string | null;
  billingAmountArs: number | null;
  billingPriceVersion: number | null;
  pendingCheckoutAmountArs: number | null;
  pendingCheckoutPriceVersion: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  cancelAtPeriodEnd: boolean;
  providerStatus: string | null;
  hasPreapproval: boolean;
  currentPeriodStart: string | null;
  updatedAt: string;
}

interface PaymentDto extends Record<string, unknown> {
  id: string;
  organizationId: string;
  organizationName: string;
  subscriptionId: string | null;
  planCode: string | null;
  amountArs: number;
  currencyId: string;
  status: string;
  provider: string;
  providerPaymentReference: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface AuditDto extends Record<string, unknown> {
  id: string;
  actorUserId: string | null;
  actorAlias: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  previousState: Record<string, unknown> | null;
  nextState: Record<string, unknown> | null;
  result: 'success' | 'partial' | 'failure';
  requestId: string;
  createdAt: string;
}

interface PriceChangeItemDto extends Record<string, unknown> {
  id: string;
  batchId: string;
  organizationId: string;
  organizationName: string;
  subscriptionId: string;
  itemType: string;
  status: string;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  processedAt: string | null;
  updatedAt: string;
}

const OPERATIONS: readonly QueryOperation[] = [
  'overview',
  'organizations',
  'users',
  'subscriptions',
  'payments',
  'audit',
  'price_change_status',
];

function normalizedSearch(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().slice(0, 200).toLocaleLowerCase('es')
    : '';
}

function includesSearch(values: unknown[], search: string): boolean {
  if (!search) return true;
  return values.some((value) => String(value ?? '').toLocaleLowerCase('es').includes(search));
}

function recordFilter(filters: unknown): Record<string, unknown> {
  return isRecord(filters) ? filters : {};
}

function future(value: unknown): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now();
}

function allowedAdminState(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  const allowedKeys = [
    'amountArs',
    'priceVersion',
    'updatedAt',
    'batchId',
    'total',
    'processed',
    'succeeded',
    'failed',
    'skipped',
  ];

  return Object.fromEntries(
    allowedKeys
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, value[key]]),
  );
}

function batchStatus(value: unknown): string {
  return value === 'partially_completed' ? 'partially_failed' : (stringValue(value) ?? 'failed');
}

function batchDto(
  row: Record<string, unknown> | undefined,
  itemRows: Record<string, unknown>[] = [],
): Record<string, unknown> | null {
  if (!row) return null;
  const pendingCount = numberValue(row.pending_count) ??
    itemRows.filter((item) => item.status === 'pending').length;
  const processingCount = numberValue(row.processing_count) ??
    itemRows.filter((item) => item.status === 'processing').length;
  const retryableCount = numberValue(row.retryable_count) ?? itemRows.filter((item) => (
    item.status === 'failed' ||
    (item.status === 'skipped' && item.error_code === 'missing_preapproval')
  )).length;
  return {
    id: stringValue(row.id),
    planCode: stringValue(row.plan_code),
    previousAmountArs: numberValue(row.old_amount_ars),
    nextAmountArs: numberValue(row.new_amount_ars),
    previousPriceVersion: numberValue(row.old_price_version),
    nextPriceVersion: numberValue(row.new_price_version),
    status: batchStatus(row.status),
    eligibleCount: Math.max(
      (numberValue(row.total_items) ?? itemRows.length) - (numberValue(row.skipped_items) ?? 0),
      0,
    ),
    pendingCount,
    processingCount,
    succeededCount: numberValue(row.succeeded_items) ?? 0,
    failedCount: numberValue(row.failed_items) ?? 0,
    skippedCount: numberValue(row.skipped_items) ?? 0,
    retryableCount,
    actorUserId: stringValue(row.actor_user_id) ?? '',
    actorAlias: stringValue(row.actor_alias) ?? 'admin',
    reason: stringValue(row.reason),
    startedAt: stringValue(row.started_at),
    completedAt: stringValue(row.completed_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

async function overview(supabaseAdmin: Parameters<typeof fetchAllRows>[0]) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const [{ data: overviewRow, error: overviewError }, users, profiles] = await Promise.all([
    supabaseAdmin
      .from('platform_admin_overview_v')
      .select('barberias_acceso,approved_payments_count,approved_payments_amount_ars,incidencias,organizations_breakdown,subscriptions_breakdown,payments_30_breakdown,price_changes_breakdown')
      .single(),
    listAllAuthUsers(supabaseAdmin),
    fetchAllRows(supabaseAdmin, 'profiles', 'id,organization_id'),
  ]);
  if (overviewError || !overviewRow) throw new Error('OVERVIEW_READ_FAILED');

  const tenantUserIds = new Set(
    profiles
      .filter((profile) => stringValue(profile.organization_id))
      .map((profile) => String(profile.id)),
  );

  const breakdown = (value: unknown): Record<string, number> => {
    if (!isRecord(value)) return {};
    return Object.fromEntries(
      Object.entries(value).map(([key, count]) => [
        key === 'partially_completed' ? 'partially_failed' : key,
        numberValue(count) ?? 0,
      ]),
    );
  };

  return {
    generatedAt: new Date().toISOString(),
    barberiasAcceso: numberValue(overviewRow.barberias_acceso) ?? 0,
    mau30: users.filter((user) => (
      user.app_metadata?.platform_role !== 'platform_admin' &&
      tenantUserIds.has(user.id) &&
      Boolean(user.last_sign_in_at) &&
      Date.parse(user.last_sign_in_at as string) >= thirtyDaysAgo
    )).length,
    cobrosAprobados30: {
      count: numberValue(overviewRow.approved_payments_count) ?? 0,
      amountArs: numberValue(overviewRow.approved_payments_amount_ars) ?? 0,
    },
    incidencias: numberValue(overviewRow.incidencias) ?? 0,
    breakdowns: {
      organizations: breakdown(overviewRow.organizations_breakdown),
      subscriptions: breakdown(overviewRow.subscriptions_breakdown),
      payments30: breakdown(overviewRow.payments_30_breakdown),
      priceChanges: breakdown(overviewRow.price_changes_breakdown),
    },
  };
}

async function organizations(
  supabaseAdmin: Parameters<typeof fetchAllRows>[0],
  body: QueryBody,
) {
  const page = parsePageRequest(body);
  const search = normalizedSearch(body.search);
  const filters = recordFilter(body.filters);
  const sort = parseSortRequest(
    body.sort,
    ['name', 'createdAt', 'usersCount', 'branchesCount', 'mau30', 'accessStatus', 'planCode', 'currentPeriodEnd'],
    'createdAt',
  );

  const [profileRows, authUsers] = await Promise.all([
    fetchAllRows(supabaseAdmin, 'profiles', 'id,organization_id'),
    listAllAuthUsers(supabaseAdmin),
  ]);
  const profileOrganizationByUser = new Map(
    profileRows
      .filter((profile) => profile.id && profile.organization_id)
      .map((profile) => [String(profile.id), String(profile.organization_id)]),
  );
  const mauCounts = new Map<string, number>();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const user of authUsers) {
    if (user.app_metadata?.platform_role === 'platform_admin' || !user.last_sign_in_at) continue;
    if (Date.parse(user.last_sign_in_at) < thirtyDaysAgo) continue;
    const organizationId = profileOrganizationByUser.get(user.id);
    if (organizationId) mauCounts.set(organizationId, (mauCounts.get(organizationId) ?? 0) + 1);
  }

  const toDto = (row: Record<string, unknown>): OrganizationDto => ({
    id: String(row.id),
    name: stringValue(row.name) ?? 'Sin nombre',
    slug: stringValue(row.slug),
    isEnabled: row.is_enabled === true,
    createdAt: stringValue(row.created_at) ?? '',
    accessStatus: stringValue(row.access_status) ?? 'unknown',
    planCode: stringValue(row.plan_code),
    planName: stringValue(row.plan_name),
    trialEndsAt: stringValue(row.trial_ends_at),
    currentPeriodEnd: stringValue(row.current_period_end),
    billingAmountArs: numberValue(row.billing_amount_ars),
    branchesCount: numberValue(row.branches_count) ?? 0,
    usersCount: numberValue(row.users_count) ?? 0,
    mau30: mauCounts.get(String(row.id)) ?? 0,
    lastPaymentAt: stringValue(row.last_payment_at),
  });
  const select = 'id,name,slug,is_enabled,created_at,access_status,plan_code,plan_name,trial_ends_at,current_period_end,billing_amount_ars,branches_count,users_count,last_payment_at';

  // Auth owns last_sign_in_at, so activity sorting is the one operation that
  // must merge the complete, already-aggregated organization view in Edge.
  if (sort.field === 'mau30') {
    let items = (await fetchAllRows(supabaseAdmin, 'platform_admin_organizations_v', select))
      .map(toDto)
      .filter((item) => (
        includesSearch([item.name, item.slug], search) &&
        (!stringValue(filters.planCode) || item.planCode === filters.planCode) &&
        (!stringValue(filters.accessStatus) || item.accessStatus === filters.accessStatus) &&
        (booleanValue(filters.isEnabled) === null || item.isEnabled === filters.isEnabled)
      ));
    items = sortItems(items, 'mau30', sort.direction);
    return paginate(items, page);
  }

  const sortColumns: Record<string, string> = {
    name: 'name',
    createdAt: 'created_at',
    usersCount: 'users_count',
    branchesCount: 'branches_count',
    accessStatus: 'access_status',
    planCode: 'plan_code',
    currentPeriodEnd: 'current_period_end',
  };
  let query = supabaseAdmin
    .from('platform_admin_organizations_v')
    .select(select, { count: 'exact' });
  if (search) query = query.ilike('search_text', `%${search}%`);
  const planFilter = stringValue(filters.planCode);
  const statusFilter = stringValue(filters.accessStatus);
  const enabledFilter = booleanValue(filters.isEnabled);
  if (planFilter) query = query.eq('plan_code', planFilter);
  if (statusFilter) query = query.eq('access_status', statusFilter);
  if (enabledFilter !== null) query = query.eq('is_enabled', enabledFilter);

  const from = (page.page - 1) * page.pageSize;
  const { data, error, count } = await query
    .order(sortColumns[sort.field] ?? 'created_at', {
      ascending: sort.direction === 'asc',
      nullsFirst: false,
    })
    .range(from, from + page.pageSize - 1);
  if (error) throw error;
  return {
    items: ((data ?? []) as Record<string, unknown>[]).map(toDto),
    page: page.page,
    pageSize: page.pageSize,
    total: count ?? 0,
  };
}

async function users(
  supabaseAdmin: Parameters<typeof fetchAllRows>[0],
  body: QueryBody,
) {
  const page = parsePageRequest(body);
  const search = normalizedSearch(body.search);
  const filters = recordFilter(body.filters);
  const sort = parseSortRequest(
    body.sort,
    ['fullName', 'email', 'organizationName', 'createdAt', 'lastSignInAt', 'status'],
    'createdAt',
  );
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const [authUsers, profiles, roles, organizations] = await Promise.all([
    listAllAuthUsers(supabaseAdmin),
    fetchAllRows(supabaseAdmin, 'profiles', 'id,email,full_name,organization_id,created_at'),
    fetchAllRows(supabaseAdmin, 'user_roles', 'user_id,role'),
    fetchAllRows(supabaseAdmin, 'organizations', 'id,name,slug,is_active'),
  ]);

  const profilesById = new Map(profiles.map((profile) => [String(profile.id), profile]));
  const organizationNames = new Map(
    organizations.map((organization) => [String(organization.id), stringValue(organization.name) ?? 'Sin nombre']),
  );
  const organizationsById = new Map(
    organizations.map((organization) => [String(organization.id), organization]),
  );
  const rolesByUser = new Map<string, string[]>();
  for (const roleRow of roles) {
    const userId = String(roleRow.user_id);
    const role = stringValue(roleRow.role);
    if (!role) continue;
    rolesByUser.set(userId, [...(rolesByUser.get(userId) ?? []), role]);
  }

  let items: UserDto[] = authUsers
    .filter((user) => user.app_metadata?.platform_role !== 'platform_admin')
    .map((user): UserDto | null => {
      const profile = profilesById.get(user.id);
      const organizationId = stringValue(profile?.organization_id);
      if (!profile || !organizationId) return null;
      const lastSignInAt = user.last_sign_in_at ?? null;
      const isBanned = future(user.banned_until);
      const organization = organizationsById.get(organizationId);

      return {
        id: user.id,
        fullName: stringValue(profile.full_name),
        email: user.email ?? stringValue(profile.email) ?? '',
        organizationId,
        organizationName: organizationNames.get(organizationId) ?? 'Organizacion eliminada',
        organizationSlug: stringValue(organization?.slug),
        roles: (rolesByUser.get(user.id) ?? []).sort(),
        createdAt: user.created_at ?? stringValue(profile.created_at),
        lastSignInAt,
        isMau30: Boolean(lastSignInAt && Date.parse(lastSignInAt) >= thirtyDaysAgo),
        status: isBanned
          ? 'disabled'
          : !user.email_confirmed_at
            ? 'invited'
            : organization?.is_active === false
              ? 'inactive'
              : 'active',
      } satisfies UserDto;
    })
    .filter((item): item is UserDto => Boolean(item));

  const roleFilter = stringValue(filters.role);
  items = items.filter((item) => (
    includesSearch([item.fullName, item.email, item.organizationName], search) &&
    (!stringValue(filters.organizationId) || item.organizationId === filters.organizationId) &&
    (!roleFilter || item.roles.includes(roleFilter)) &&
    (!stringValue(filters.status) || item.status === filters.status) &&
    (
      !stringValue(filters.activity) ||
      (filters.activity === 'mau30' ? item.isMau30 : !item.isMau30)
    )
  ));

  return paginate(sortItems(items, sort.field as keyof UserDto, sort.direction), page);
}

async function subscriptions(
  supabaseAdmin: Parameters<typeof fetchAllRows>[0],
  body: QueryBody,
) {
  const page = parsePageRequest(body);
  const search = normalizedSearch(body.search);
  const filters = recordFilter(body.filters);
  const sort = parseSortRequest(
    body.sort,
    ['organizationName', 'status', 'effectivePlanCode', 'currentPeriodEnd', 'nextPaymentDate', 'updatedAt'],
    'updatedAt',
  );

  const select = 'id,organization_id,organization_name,organization_slug,access_status,provider,effective_plan_code,pending_plan_code,billing_plan_code,billing_amount_ars,billing_price_version,pending_checkout_amount_ars,pending_checkout_price_version,trial_ends_at,current_period_start,current_period_end,next_payment_date,cancel_at_period_end,mercadopago_status,has_preapproval,updated_at';
  let query = supabaseAdmin
    .from('platform_admin_subscriptions_v')
    .select(select, { count: 'exact' });
  if (search) query = query.ilike('search_text', `%${search}%`);
  const statusFilter = stringValue(filters.status);
  const planFilter = stringValue(filters.planCode);
  const organizationFilter = stringValue(filters.organizationId);
  if (statusFilter) query = query.eq('access_status', statusFilter);
  if (planFilter) query = query.eq('resolved_plan_code', planFilter);
  if (organizationFilter) query = query.eq('organization_id', organizationFilter);

  const sortColumns: Record<string, string> = {
    organizationName: 'organization_name',
    status: 'access_status',
    effectivePlanCode: 'effective_plan_code',
    currentPeriodEnd: 'current_period_end',
    nextPaymentDate: 'next_payment_date',
    updatedAt: 'updated_at',
  };
  const from = (page.page - 1) * page.pageSize;
  const [{ data: subscriptionRows, error: subscriptionError, count }, { data: planRows, error: plansError }] = await Promise.all([
    query
      .order(sortColumns[sort.field] ?? 'updated_at', {
        ascending: sort.direction === 'asc',
        nullsFirst: false,
      })
      .range(from, from + page.pageSize - 1),
    supabaseAdmin
      .from('subscription_plans')
      .select('code,name,description,amount_ars,price_version,billing_period,is_active,sort_order,updated_at')
      .order('sort_order', { ascending: true }),
  ]);
  if (subscriptionError || plansError) throw subscriptionError ?? plansError;

  const items: SubscriptionDto[] = ((subscriptionRows ?? []) as Record<string, unknown>[]).map((subscription) => ({
    id: String(subscription.id),
    organizationId: String(subscription.organization_id),
    organizationName: stringValue(subscription.organization_name) ?? 'Organizacion eliminada',
    organizationSlug: stringValue(subscription.organization_slug),
    status: stringValue(subscription.access_status) ?? 'unknown',
    provider: stringValue(subscription.provider) ?? 'unknown',
    effectivePlanCode: stringValue(subscription.effective_plan_code) ?? 'unknown',
    pendingPlanCode: stringValue(subscription.pending_plan_code),
    billingPlanCode: stringValue(subscription.billing_plan_code),
    billingAmountArs: numberValue(subscription.billing_amount_ars),
    billingPriceVersion: numberValue(subscription.billing_price_version),
    pendingCheckoutAmountArs: numberValue(subscription.pending_checkout_amount_ars),
    pendingCheckoutPriceVersion: numberValue(subscription.pending_checkout_price_version),
    trialEndsAt: stringValue(subscription.trial_ends_at),
    currentPeriodStart: stringValue(subscription.current_period_start),
    currentPeriodEnd: stringValue(subscription.current_period_end),
    nextPaymentDate: stringValue(subscription.next_payment_date),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    providerStatus: stringValue(subscription.mercadopago_status),
    hasPreapproval: subscription.has_preapproval === true,
    updatedAt: stringValue(subscription.updated_at) ?? '',
  }));

  return {
    items,
    page: page.page,
    pageSize: page.pageSize,
    total: count ?? 0,
    plans: (planRows ?? [])
      .map((plan) => ({
        code: stringValue(plan.code),
        name: stringValue(plan.name),
        description: stringValue(plan.description),
        amountArs: numberValue(plan.amount_ars),
        priceVersion: numberValue(plan.price_version),
        billingPeriod: stringValue(plan.billing_period),
        isActive: plan.is_active === true,
        sortOrder: numberValue(plan.sort_order) ?? 0,
        updatedAt: stringValue(plan.updated_at),
      })),
  };
}

async function payments(
  supabaseAdmin: Parameters<typeof fetchAllRows>[0],
  body: QueryBody,
) {
  const page = parsePageRequest(body);
  const search = normalizedSearch(body.search);
  const filters = recordFilter(body.filters);
  const sort = parseSortRequest(
    body.sort,
    ['organizationName', 'amountArs', 'status', 'paidAt', 'createdAt'],
    'createdAt',
  );

  const select = 'id,organization_id,organization_name,subscription_id,plan_code,amount_ars,currency_id,status,provider,mercadopago_payment_id,mercadopago_authorized_payment_id,period_start,period_end,due_at,paid_at,created_at';
  let query = supabaseAdmin
    .from('platform_admin_payments_v')
    .select(select, { count: 'exact' });
  if (search) query = query.ilike('search_text', `%${search}%`);
  const statusFilter = stringValue(filters.status);
  const planFilter = stringValue(filters.planCode);
  const organizationFilter = stringValue(filters.organizationId);
  if (statusFilter) query = query.eq('status', statusFilter);
  if (planFilter) query = query.eq('plan_code', planFilter);
  if (organizationFilter) query = query.eq('organization_id', organizationFilter);
  const dateFrom = stringValue(filters.dateFrom);
  const dateTo = stringValue(filters.dateTo);
  const parsedFrom = dateFrom ? Date.parse(dateFrom) : Number.NaN;
  const parsedTo = dateTo ? Date.parse(dateTo) : Number.NaN;
  if (Number.isFinite(parsedFrom)) query = query.gte('effective_at', new Date(parsedFrom).toISOString());
  if (Number.isFinite(parsedTo)) query = query.lte('effective_at', new Date(parsedTo).toISOString());

  const sortColumns: Record<string, string> = {
    organizationName: 'organization_name',
    amountArs: 'amount_ars',
    status: 'status',
    paidAt: 'paid_at',
    createdAt: 'created_at',
  };
  const from = (page.page - 1) * page.pageSize;
  const { data: paymentRows, error, count } = await query
    .order(sortColumns[sort.field] ?? 'created_at', {
      ascending: sort.direction === 'asc',
      nullsFirst: false,
    })
    .range(from, from + page.pageSize - 1);
  if (error) throw error;

  const items: PaymentDto[] = ((paymentRows ?? []) as Record<string, unknown>[]).map((payment) => ({
    id: String(payment.id),
    organizationId: String(payment.organization_id),
    organizationName: stringValue(payment.organization_name) ?? 'Organizacion eliminada',
    subscriptionId: stringValue(payment.subscription_id),
    planCode: stringValue(payment.plan_code ?? payment.billing_plan_code),
    amountArs: numberValue(payment.amount_ars) ?? 0,
    currencyId: stringValue(payment.currency_id) ?? 'ARS',
    status: stringValue(payment.status) ?? 'unknown',
    provider: stringValue(payment.provider) ?? 'unknown',
    providerPaymentReference: maskReference(
      payment.mercadopago_payment_id ?? payment.mercadopago_authorized_payment_id,
    ),
    periodStart: stringValue(payment.period_start),
    periodEnd: stringValue(payment.period_end),
    dueAt: stringValue(payment.due_at),
    paidAt: stringValue(payment.paid_at),
    createdAt: stringValue(payment.created_at) ?? '',
  }));

  return { items, page: page.page, pageSize: page.pageSize, total: count ?? 0 };
}

async function audit(
  supabaseAdmin: Parameters<typeof fetchAllRows>[0],
  body: QueryBody,
) {
  const page = parsePageRequest(body);
  const search = normalizedSearch(body.search);
  const filters = recordFilter(body.filters);
  const sort = parseSortRequest(body.sort, ['createdAt', 'action', 'result'], 'createdAt');
  const select = 'id,actor_user_id,actor_alias,action,target_type,target_id,reason,previous_state,next_state,result_status,result,request_id,created_at';
  let query = supabaseAdmin
    .from('platform_admin_audit_v')
    .select(select, { count: 'exact' });
  if (search) query = query.ilike('search_text', `%${search}%`);
  const actionFilter = stringValue(filters.action);
  const actorFilter = stringValue(filters.actorUserId);
  const resultFilter = stringValue(filters.result);
  if (actionFilter) query = query.eq('action', actionFilter);
  if (actorFilter) query = query.eq('actor_user_id', actorFilter);
  if (resultFilter) query = query.eq('result', resultFilter);
  const dateFrom = stringValue(filters.dateFrom);
  const dateTo = stringValue(filters.dateTo);
  const parsedFrom = dateFrom ? Date.parse(dateFrom) : Number.NaN;
  const parsedTo = dateTo ? Date.parse(dateTo) : Number.NaN;
  if (Number.isFinite(parsedFrom)) query = query.gte('created_at', new Date(parsedFrom).toISOString());
  if (Number.isFinite(parsedTo)) query = query.lte('created_at', new Date(parsedTo).toISOString());

  const sortColumns: Record<string, string> = {
    createdAt: 'created_at',
    action: 'action',
    result: 'result',
  };
  const from = (page.page - 1) * page.pageSize;
  const { data: rows, error, count } = await query
    .order(sortColumns[sort.field] ?? 'created_at', {
      ascending: sort.direction === 'asc',
      nullsFirst: false,
    })
    .range(from, from + page.pageSize - 1);
  if (error) throw error;

  const items: AuditDto[] = ((rows ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    actorUserId: stringValue(row.actor_user_id),
    actorAlias: stringValue(row.actor_alias) ?? 'admin',
    action: stringValue(row.action) ?? 'unknown',
    targetType: stringValue(row.target_type),
    targetId: stringValue(row.target_id),
    reason: stringValue(row.reason),
    previousState: isRecord(row.previous_state) ? allowedAdminState(row.previous_state) : null,
    nextState: isRecord(row.next_state) ? allowedAdminState(row.next_state) : null,
    result: row.result === 'success' || row.result === 'failure' ? row.result : 'partial',
    requestId: stringValue(row.request_id) ?? '',
    createdAt: stringValue(row.created_at) ?? '',
  }));

  return { items, page: page.page, pageSize: page.pageSize, total: count ?? 0 };
}

async function priceChangeStatus(
  supabaseAdmin: Parameters<typeof fetchAllRows>[0],
  body: QueryBody,
) {
  const page = parsePageRequest(body);
  const filters = recordFilter(body.filters);
  const requestedBatchId = stringValue(filters.batchId);
  const batchSelect = 'id,plan_code,old_amount_ars,new_amount_ars,old_price_version,new_price_version,status,total_items,processed_items,succeeded_items,failed_items,skipped_items,pending_count,processing_count,retryable_count,actor_user_id,actor_alias,reason,started_at,completed_at,created_at,updated_at';
  let batchQuery = supabaseAdmin
    .from('platform_admin_price_change_batches_v')
    .select(batchSelect)
    .order('created_at', { ascending: false })
    .limit(1);
  const planFilter = stringValue(filters.planCode);
  if (requestedBatchId) batchQuery = batchQuery.eq('id', requestedBatchId);
  else if (planFilter) batchQuery = batchQuery.eq('plan_code', planFilter);
  const { data: selectedBatch, error: batchError } = await batchQuery.maybeSingle();
  if (batchError) throw batchError;

  if (!selectedBatch) {
    return {
      batch: null,
      items: { items: [], page: page.page, pageSize: page.pageSize, total: 0 },
      counts: {},
    };
  }

  const itemSelect = 'id,batch_id,organization_id,organization_name,subscription_id,preapproval_id,item_type,status,attempts,last_http_status,error_code,error_message,claimed_at,completed_at,updated_at';
  let itemQuery = supabaseAdmin
    .from('platform_admin_price_change_items_v')
    .select(itemSelect, { count: 'exact' })
    .eq('batch_id', selectedBatch.id);
  const itemStatus = stringValue(filters.itemStatus);
  const itemType = stringValue(filters.itemType);
  if (itemStatus) itemQuery = itemQuery.eq('status', itemStatus);
  if (itemType) itemQuery = itemQuery.eq('item_type', itemType);
  const from = (page.page - 1) * page.pageSize;
  const { data: rows, error: itemsError, count } = await itemQuery
    .order('updated_at', { ascending: false })
    .range(from, from + page.pageSize - 1);
  if (itemsError) throw itemsError;

  const items: PriceChangeItemDto[] = ((rows ?? []) as Record<string, unknown>[])
    .map((row) => ({
      id: String(row.id),
      batchId: String(row.batch_id),
      organizationId: stringValue(row.organization_id) ?? '',
      organizationName: stringValue(row.organization_name) ?? 'Organizacion eliminada',
      subscriptionId: stringValue(row.subscription_id) ?? '',
      itemType: stringValue(row.item_type) ?? 'unknown',
      status: stringValue(row.status) ?? 'unknown',
      attempts: numberValue(row.attempts) ?? 0,
      errorCode: stringValue(row.error_code),
      errorMessage: stringValue(row.error_message),
      processedAt: stringValue(row.completed_at),
      updatedAt: stringValue(row.updated_at) ?? '',
    }));

  return {
    batch: batchDto(selectedBatch as Record<string, unknown>),
    items: { items, page: page.page, pageSize: page.pageSize, total: count ?? 0 },
    counts: {
      pending: numberValue(selectedBatch.pending_count) ?? 0,
      processing: numberValue(selectedBatch.processing_count) ?? 0,
      succeeded: numberValue(selectedBatch.succeeded_items) ?? 0,
      failed: numberValue(selectedBatch.failed_items) ?? 0,
      skipped: numberValue(selectedBatch.skipped_items) ?? 0,
    },
  };
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

  let body: QueryBody;
  try {
    body = await req.json() as QueryBody;
  } catch {
    return jsonError(req, 'JSON invalido.', 400, 'INVALID_JSON', requestId);
  }

  if (typeof body.operation !== 'string' || !OPERATIONS.includes(body.operation as QueryOperation)) {
    return jsonError(req, 'Operacion invalida.', 400, 'INVALID_OPERATION', requestId);
  }

  try {
    let data: unknown;
    switch (body.operation as QueryOperation) {
      case 'overview':
        data = await overview(auth.supabaseAdmin!);
        break;
      case 'organizations':
        data = await organizations(auth.supabaseAdmin!, body);
        break;
      case 'users':
        data = await users(auth.supabaseAdmin!, body);
        break;
      case 'subscriptions':
        data = await subscriptions(auth.supabaseAdmin!, body);
        break;
      case 'payments':
        data = await payments(auth.supabaseAdmin!, body);
        break;
      case 'audit':
        data = await audit(auth.supabaseAdmin!, body);
        break;
      case 'price_change_status':
        data = await priceChangeStatus(auth.supabaseAdmin!, body);
        break;
    }

    return jsonResponse(req, { ...isRecord(data) ? data : { data }, requestId }, 200, requestId);
  } catch (error) {
    console.error(`[platform-admin-query] ${requestId}: ${sanitizeMessage(error)}`);
    return jsonError(req, 'No se pudo cargar la informacion administrativa.', 500, 'ADMIN_QUERY_FAILED', requestId);
  }
});
