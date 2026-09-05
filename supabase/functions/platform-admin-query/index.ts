import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  booleanValue,
  fetchAllRows,
  getPlatformAdminContext,
  getRequestId,
  hasSubscriptionAccess,
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
  type SortDirection,
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

function effectiveSubscriptionStatus(subscription: Record<string, unknown>): string {
  const status = stringValue(subscription.status) ?? 'unknown';
  if (status === 'trialing') return future(subscription.trial_ends_at) ? 'trialing' : 'expired';
  if (status === 'active' || status === 'cancelled') {
    if (future(subscription.current_period_end)) return status;
    return stringValue(subscription.current_period_end) ? 'expired' : 'legacy';
  }
  return status;
}

function planCodeForSubscription(subscription: Record<string, unknown>): string | null {
  return stringValue(
    subscription.billing_plan_code ??
      subscription.current_plan_code ??
      subscription.effective_plan_code,
  );
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
  const pendingCount = itemRows.filter((item) => item.status === 'pending').length;
  const processingCount = itemRows.filter((item) => item.status === 'processing').length;
  const retryableCount = itemRows.filter((item) => (
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
  const [organizations, subscriptions, payments, priceItems, priceBatches, users, profiles, webhookEvents] = await Promise.all([
    fetchAllRows(supabaseAdmin, 'organizations', 'id,is_active'),
    fetchAllRows(
      supabaseAdmin,
      'organization_subscriptions',
      'organization_id,status,current_plan_code,effective_plan_code,billing_plan_code,trial_ends_at,current_period_end',
    ),
    fetchAllRows(supabaseAdmin, 'subscription_payments', 'status,amount_ars,paid_at,created_at'),
    fetchAllRows(supabaseAdmin, 'subscription_price_change_items', 'status'),
    fetchAllRows(supabaseAdmin, 'subscription_price_change_batches', 'status'),
    listAllAuthUsers(supabaseAdmin),
    fetchAllRows(supabaseAdmin, 'profiles', 'id,organization_id'),
    fetchAllRows(supabaseAdmin, 'mercadopago_subscription_events', 'processed_at,created_at'),
  ]);

  const tenantUserIds = new Set(
    profiles
      .filter((profile) => stringValue(profile.organization_id))
      .map((profile) => String(profile.id)),
  );

  const enabledOrganizations = new Set(
    organizations
      .filter((organization) => organization.is_active !== false)
      .map((organization) => stringValue(organization.id))
      .filter((id): id is string => Boolean(id)),
  );

  const accessSubscriptions = subscriptions.filter((subscription) => (
    enabledOrganizations.has(String(subscription.organization_id)) &&
    hasSubscriptionAccess(
      subscription.status,
      subscription.trial_ends_at,
      subscription.current_period_end,
    )
  ));

  const approvedPayments = payments.filter((payment) => (
    payment.status === 'approved' &&
    typeof payment.paid_at === 'string' &&
    Date.parse(payment.paid_at) >= thirtyDaysAgo
  ));

  const subscriptionIncidents = subscriptions.filter((subscription) => {
    const effectiveStatus = effectiveSubscriptionStatus(subscription);
    return effectiveStatus === 'past_due' || effectiveStatus === 'expired' || (
      effectiveStatus === 'legacy' &&
      (subscription.status === 'active' || subscription.status === 'cancelled')
    );
  }).length;
  const priceChangeIncidents = priceItems.filter((item) => item.status === 'failed').length;
  const adversePaymentIncidents = payments.filter((payment) => (
    ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(String(payment.status)) &&
    typeof payment.created_at === 'string' &&
    Date.parse(payment.created_at) >= thirtyDaysAgo
  )).length;
  const staleWebhookIncidents = webhookEvents.filter((event) => (
    !event.processed_at &&
    typeof event.created_at === 'string' &&
    Date.parse(event.created_at) <= Date.now() - 5 * 60 * 1000
  )).length;

  const organizationStatuses: Record<string, number> = {};
  const subscriptionStatuses: Record<string, number> = {};
  const paymentStatuses30: Record<string, number> = {};
  const priceChangeStatuses: Record<string, number> = {};
  const subscriptionsByOrganization = new Map(
    subscriptions.map((subscription) => [String(subscription.organization_id), subscription]),
  );
  for (const organization of organizations) {
    const subscription = subscriptionsByOrganization.get(String(organization.id));
    let status = 'unknown';
    if (organization.is_active === false) status = 'inactive';
    else if (!subscription) status = 'legacy';
    else status = effectiveSubscriptionStatus(subscription);
    organizationStatuses[status] = (organizationStatuses[status] ?? 0) + 1;
  }
  for (const subscription of subscriptions) {
    const status = effectiveSubscriptionStatus(subscription);
    subscriptionStatuses[status] = (subscriptionStatuses[status] ?? 0) + 1;
  }
  for (const payment of payments) {
    const effectiveAt = payment.status === 'approved' ? payment.paid_at : payment.created_at;
    if (typeof effectiveAt !== 'string' || Date.parse(effectiveAt) < thirtyDaysAgo) continue;
    const status = stringValue(payment.status) ?? 'unknown';
    paymentStatuses30[status] = (paymentStatuses30[status] ?? 0) + 1;
  }
  for (const batch of priceBatches) {
    const status = batchStatus(batch.status);
    priceChangeStatuses[status] = (priceChangeStatuses[status] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    barberiasAcceso: accessSubscriptions.length,
    mau30: users.filter((user) => (
      user.app_metadata?.platform_role !== 'platform_admin' &&
      tenantUserIds.has(user.id) &&
      Boolean(user.last_sign_in_at) &&
      Date.parse(user.last_sign_in_at as string) >= thirtyDaysAgo
    )).length,
    cobrosAprobados30: {
      count: approvedPayments.length,
      amountArs: approvedPayments.reduce(
        (total, payment) => total + (numberValue(payment.amount_ars) ?? 0),
        0,
      ),
    },
    incidencias:
      subscriptionIncidents +
      priceChangeIncidents +
      adversePaymentIncidents +
      staleWebhookIncidents,
    breakdowns: {
      organizations: organizationStatuses,
      subscriptions: subscriptionStatuses,
      payments30: paymentStatuses30,
      priceChanges: priceChangeStatuses,
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

  const [organizationRows, subscriptionRows, profileRows, branchRows, planRows, authUsers] = await Promise.all([
    fetchAllRows(
      supabaseAdmin,
      'organizations',
      'id,name,slug,is_active,created_at,last_payment_at',
    ),
    fetchAllRows(
      supabaseAdmin,
      'organization_subscriptions',
      'organization_id,status,current_plan_code,effective_plan_code,billing_plan_code,billing_amount_ars,trial_ends_at,current_period_end,last_payment_at',
    ),
    fetchAllRows(supabaseAdmin, 'profiles', 'id,organization_id'),
    fetchAllRows(supabaseAdmin, 'sucursales', 'organization_id,deleted_at'),
    fetchAllRows(supabaseAdmin, 'subscription_plans', 'code,name'),
    listAllAuthUsers(supabaseAdmin),
  ]);

  const subscriptionsByOrganization = new Map(
    subscriptionRows.map((subscription) => [String(subscription.organization_id), subscription]),
  );
  const userCounts = new Map<string, number>();
  for (const profile of profileRows) {
    const organizationId = stringValue(profile.organization_id);
    if (organizationId) userCounts.set(organizationId, (userCounts.get(organizationId) ?? 0) + 1);
  }
  const branchCounts = new Map<string, number>();
  for (const branch of branchRows) {
    const organizationId = stringValue(branch.organization_id);
    if (organizationId && !branch.deleted_at) {
      branchCounts.set(organizationId, (branchCounts.get(organizationId) ?? 0) + 1);
    }
  }
  const planNames = new Map(
    planRows.map((plan) => [String(plan.code), stringValue(plan.name) ?? String(plan.code)]),
  );
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

  let items: OrganizationDto[] = organizationRows.map((organization) => {
    const id = String(organization.id);
    const subscription = subscriptionsByOrganization.get(id);
    const hasAccess = Boolean(
      organization.is_active !== false &&
      subscription &&
      hasSubscriptionAccess(
        subscription.status,
        subscription.trial_ends_at,
        subscription.current_period_end,
      ),
    );
    const status = subscription ? effectiveSubscriptionStatus(subscription) : null;
    const planCode = subscription ? planCodeForSubscription(subscription) : null;
    const accessStatus = organization.is_active === false
      ? 'inactive'
      : !subscription
        ? 'legacy'
        : status ?? 'unknown';

    return {
      id,
      name: stringValue(organization.name) ?? 'Sin nombre',
      slug: stringValue(organization.slug),
      isEnabled: organization.is_active !== false,
      createdAt: stringValue(organization.created_at) ?? '',
      accessStatus: hasAccess
        ? accessStatus
        : accessStatus === 'trialing' || accessStatus === 'active' || accessStatus === 'cancelled'
          ? 'expired'
          : accessStatus,
      planCode,
      planName: planCode ? planNames.get(planCode) ?? planCode : null,
      trialEndsAt: stringValue(subscription?.trial_ends_at),
      currentPeriodEnd: stringValue(subscription?.current_period_end),
      billingAmountArs: numberValue(subscription?.billing_amount_ars),
      branchesCount: branchCounts.get(id) ?? 0,
      usersCount: userCounts.get(id) ?? 0,
      mau30: mauCounts.get(id) ?? 0,
      lastPaymentAt: stringValue(subscription?.last_payment_at ?? organization.last_payment_at),
    };
  });

  items = items.filter((item) => (
    includesSearch([item.name, item.slug], search) &&
    (!stringValue(filters.planCode) || item.planCode === filters.planCode) &&
    (!stringValue(filters.accessStatus) || item.accessStatus === filters.accessStatus) &&
    (booleanValue(filters.isEnabled) === null || item.isEnabled === filters.isEnabled)
  ));

  return paginate(
    sortItems(items, sort.field as keyof OrganizationDto, sort.direction),
    page,
  );
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

  const [subscriptionRows, organizationRows, planRows] = await Promise.all([
    fetchAllRows(
      supabaseAdmin,
      'organization_subscriptions',
      'id,organization_id,status,provider,effective_plan_code,pending_plan_code,billing_plan_code,billing_amount_ars,billing_price_version,pending_checkout_amount_ars,pending_checkout_price_version,trial_ends_at,current_period_start,current_period_end,next_payment_date,cancel_at_period_end,mercadopago_status,mercadopago_preapproval_id,updated_at',
    ),
    fetchAllRows(supabaseAdmin, 'organizations', 'id,name,slug'),
    fetchAllRows(
      supabaseAdmin,
      'subscription_plans',
      'code,name,description,amount_ars,price_version,billing_period,is_active,sort_order,updated_at',
    ),
  ]);
  const organizationNames = new Map(
    organizationRows.map((organization) => [String(organization.id), stringValue(organization.name) ?? 'Sin nombre']),
  );
  const organizationSlugs = new Map(
    organizationRows.map((organization) => [String(organization.id), stringValue(organization.slug)]),
  );

  let items: SubscriptionDto[] = subscriptionRows.map((subscription) => ({
    id: String(subscription.id),
    organizationId: String(subscription.organization_id),
    organizationName: organizationNames.get(String(subscription.organization_id)) ?? 'Organizacion eliminada',
    organizationSlug: organizationSlugs.get(String(subscription.organization_id)) ?? null,
    status: effectiveSubscriptionStatus(subscription),
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
    hasPreapproval: Boolean(stringValue(subscription.mercadopago_preapproval_id)),
    updatedAt: stringValue(subscription.updated_at) ?? '',
  }));

  items = items.filter((item) => (
    includesSearch([item.organizationName], search) &&
    (!stringValue(filters.status) || item.status === filters.status) &&
    (!stringValue(filters.planCode) || (
      item.billingPlanCode === filters.planCode ||
      item.effectivePlanCode === filters.planCode
    )) &&
    (!stringValue(filters.organizationId) || item.organizationId === filters.organizationId)
  ));

  return {
    ...paginate(sortItems(items, sort.field as keyof SubscriptionDto, sort.direction), page),
    plans: planRows
      .sort((left, right) => (numberValue(left.sort_order) ?? 0) - (numberValue(right.sort_order) ?? 0))
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

  const [paymentRows, organizationRows] = await Promise.all([
    fetchAllRows(
      supabaseAdmin,
      'subscription_payments',
      'id,organization_id,subscription_id,plan_code,billing_plan_code,amount_ars,currency_id,status,provider,mercadopago_payment_id,mercadopago_authorized_payment_id,period_start,period_end,due_at,paid_at,created_at',
    ),
    fetchAllRows(supabaseAdmin, 'organizations', 'id,name'),
  ]);
  const organizationNames = new Map(
    organizationRows.map((organization) => [String(organization.id), stringValue(organization.name) ?? 'Sin nombre']),
  );

  let items: PaymentDto[] = paymentRows.map((payment) => ({
    id: String(payment.id),
    organizationId: String(payment.organization_id),
    organizationName: organizationNames.get(String(payment.organization_id)) ?? 'Organizacion eliminada',
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

  const from = stringValue(filters.dateFrom) ? Date.parse(String(filters.dateFrom)) : Number.NaN;
  const to = stringValue(filters.dateTo) ? Date.parse(String(filters.dateTo)) : Number.NaN;
  items = items.filter((item) => {
    const effectiveAt = item.paidAt ? Date.parse(item.paidAt) : Date.parse(item.createdAt);
    return (
      includesSearch([item.organizationName, item.providerPaymentReference], search) &&
      (!stringValue(filters.status) || item.status === filters.status) &&
      (!stringValue(filters.planCode) || item.planCode === filters.planCode) &&
      (!stringValue(filters.organizationId) || item.organizationId === filters.organizationId) &&
      (!Number.isFinite(from) || effectiveAt >= from) &&
      (!Number.isFinite(to) || effectiveAt <= to)
    );
  });

  return paginate(sortItems(items, sort.field as keyof PaymentDto, sort.direction), page);
}

async function audit(
  supabaseAdmin: Parameters<typeof fetchAllRows>[0],
  body: QueryBody,
) {
  const page = parsePageRequest(body);
  const search = normalizedSearch(body.search);
  const filters = recordFilter(body.filters);
  const sort = parseSortRequest(body.sort, ['createdAt', 'action', 'result'], 'createdAt');
  const rows = await fetchAllRows(
    supabaseAdmin,
    'platform_admin_audit_log',
    'id,actor_user_id,actor_alias,action,target_type,target_id,reason,previous_state,next_state,result_status,request_id,created_at',
  );

  let items: AuditDto[] = rows.map((row) => ({
    id: String(row.id),
    actorUserId: stringValue(row.actor_user_id),
    actorAlias: stringValue(row.actor_alias) ?? 'admin',
    action: stringValue(row.action) ?? 'unknown',
    targetType: stringValue(row.target_type),
    targetId: stringValue(row.target_id),
    reason: stringValue(row.reason),
    previousState: isRecord(row.previous_state) ? allowedAdminState(row.previous_state) : null,
    nextState: isRecord(row.next_state) ? allowedAdminState(row.next_state) : null,
    result: row.result_status === 'succeeded'
      ? 'success'
      : row.result_status === 'failed'
        ? 'failure'
        : 'partial',
    requestId: stringValue(row.request_id) ?? '',
    createdAt: stringValue(row.created_at) ?? '',
  }));

  items = items.filter((item) => (
    includesSearch([
      item.actorAlias,
      item.action,
      item.targetType,
      item.targetId,
      item.reason,
      item.requestId,
    ], search) &&
    (!stringValue(filters.action) || item.action === filters.action) &&
    (!stringValue(filters.actorUserId) || item.actorUserId === filters.actorUserId) &&
    (!stringValue(filters.result) || item.result === filters.result) &&
    (!stringValue(filters.dateFrom) || Date.parse(item.createdAt) >= Date.parse(String(filters.dateFrom))) &&
    (!stringValue(filters.dateTo) || Date.parse(item.createdAt) <= Date.parse(String(filters.dateTo)))
  ));

  return paginate(sortItems(items, sort.field as keyof AuditDto, sort.direction), page);
}

async function priceChangeStatus(
  supabaseAdmin: Parameters<typeof fetchAllRows>[0],
  body: QueryBody,
) {
  const page = parsePageRequest(body);
  const filters = recordFilter(body.filters);
  const requestedBatchId = stringValue(filters.batchId);
  const [batches, organizations] = await Promise.all([
    fetchAllRows(
      supabaseAdmin,
      'subscription_price_change_batches',
      'id,plan_code,old_amount_ars,new_amount_ars,old_price_version,new_price_version,status,total_items,processed_items,succeeded_items,failed_items,skipped_items,actor_user_id,actor_alias,reason,started_at,completed_at,created_at,updated_at',
    ),
    fetchAllRows(supabaseAdmin, 'organizations', 'id,name'),
  ]);
  const sortedBatches = batches.sort((left, right) => (
    String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''))
  ));
  const selectedBatch = requestedBatchId
    ? sortedBatches.find((batch) => batch.id === requestedBatchId)
    : sortedBatches.find((batch) => (
        !stringValue(filters.planCode) || batch.plan_code === filters.planCode
      ));

  if (!selectedBatch) {
    return {
      batch: null,
      items: { items: [], page: page.page, pageSize: page.pageSize, total: 0 },
      counts: {},
    };
  }

  const rows = await fetchAllRows(
    supabaseAdmin,
    'subscription_price_change_items',
    'id,batch_id,organization_id,subscription_id,preapproval_id,item_type,status,attempts,last_http_status,error_code,error_message,claimed_at,completed_at,updated_at',
  );
  const organizationNames = new Map(
    organizations.map((organization) => [String(organization.id), stringValue(organization.name) ?? 'Sin nombre']),
  );

  let items: PriceChangeItemDto[] = rows
    .filter((row) => row.batch_id === selectedBatch.id)
    .map((row) => ({
      id: String(row.id),
      batchId: String(row.batch_id),
      organizationId: String(row.organization_id),
      organizationName: organizationNames.get(String(row.organization_id)) ?? 'Organizacion eliminada',
      subscriptionId: String(row.subscription_id),
      itemType: stringValue(row.item_type) ?? 'unknown',
      status: stringValue(row.status) ?? 'unknown',
      attempts: numberValue(row.attempts) ?? 0,
      errorCode: stringValue(row.error_code),
      errorMessage: stringValue(row.error_message),
      processedAt: stringValue(row.completed_at),
      updatedAt: stringValue(row.updated_at) ?? '',
    }));

  const allItems = [...items];
  if (stringValue(filters.itemStatus)) {
    items = items.filter((item) => item.status === filters.itemStatus);
  }
  if (stringValue(filters.itemType)) {
    items = items.filter((item) => item.itemType === filters.itemType);
  }
  items = sortItems(items, 'updatedAt', 'desc');

  return {
    batch: batchDto(selectedBatch, rows.filter((row) => row.batch_id === selectedBatch.id)),
    items: paginate(items, page),
    counts: {
      pending: allItems.filter((item) => item.status === 'pending').length,
      processing: allItems.filter((item) => item.status === 'processing').length,
      succeeded: allItems.filter((item) => item.status === 'succeeded').length,
      failed: allItems.filter((item) => item.status === 'failed').length,
      skipped: allItems.filter((item) => item.status === 'skipped').length,
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
