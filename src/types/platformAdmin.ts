export type PlatformAdminOperation =
  | 'overview'
  | 'organizations'
  | 'users'
  | 'subscriptions'
  | 'payments'
  | 'audit'
  | 'price_change_status';

export type PlatformAdminSortDirection = 'asc' | 'desc';

export interface PlatformAdminSort {
  field: string;
  direction: PlatformAdminSortDirection;
}

export interface PlatformAdminPagination {
  page?: number;
  pageSize?: number;
}

export interface PlatformAdminListResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type PlatformAdminAccessStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'expired'
  | 'cancelled'
  | 'inactive'
  | 'legacy'
  | 'unknown';

export type PlatformAdminSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'expired'
  | 'cancelled'
  | 'inactive'
  | 'legacy'
  | 'unknown';

export type PlatformAdminPaymentStatus =
  | 'approved'
  | 'pending'
  | 'in_process'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back'
  | 'unknown';

export type PlatformAdminPriceBatchStatus =
  | 'pending'
  | 'processing'
  | 'partially_failed'
  | 'completed'
  | 'failed'
  | 'interrupted';

export type PlatformAdminPriceItemStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'skipped';

export type PlatformAdminPriceItemType =
  | 'active_renewal'
  | 'pending_checkout';

export interface PlatformAdminOverviewDto {
  generatedAt: string;
  barberiasAcceso: number;
  mau30: number;
  cobrosAprobados30: {
    count: number;
    amountArs: number;
  };
  incidencias: number;
  breakdowns: {
    organizations: Partial<Record<PlatformAdminAccessStatus, number>>;
    subscriptions: Partial<Record<PlatformAdminSubscriptionStatus, number>>;
    payments30: Partial<Record<PlatformAdminPaymentStatus, number>>;
    priceChanges: Partial<Record<PlatformAdminPriceBatchStatus, number>>;
  };
}

export interface PlatformAdminOrganizationDto {
  id: string;
  name: string;
  slug: string | null;
  createdAt: string;
  isEnabled: boolean;
  accessStatus: PlatformAdminAccessStatus;
  planCode: string | null;
  planName: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  billingAmountArs: number | null;
  lastPaymentAt: string | null;
  branchesCount: number;
  usersCount: number;
  mau30: number;
}

export type PlatformAdminTenantRole =
  | 'owner'
  | 'general_manager'
  | 'manager'
  | 'barber'
  | 'sucursal_account'
  | 'otros';

export interface PlatformAdminUserDto {
  id: string;
  email: string;
  fullName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  roles: PlatformAdminTenantRole[];
  createdAt: string | null;
  lastSignInAt: string | null;
  isMau30: boolean;
  status: 'active' | 'inactive' | 'invited' | 'disabled';
}

export interface PlatformAdminPlanDto {
  code: string;
  name: string;
  description: string | null;
  amountArs: number;
  priceVersion: number;
  billingPeriod: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface PlatformAdminSubscriptionDto {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string | null;
  status: PlatformAdminSubscriptionStatus;
  effectivePlanCode: string;
  billingPlanCode: string | null;
  pendingPlanCode: string | null;
  billingAmountArs: number | null;
  billingPriceVersion: number | null;
  pendingCheckoutAmountArs: number | null;
  pendingCheckoutPriceVersion: number | null;
  provider: string;
  providerStatus: string | null;
  hasPreapproval: boolean;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
}

export interface PlatformAdminPaymentDto {
  id: string;
  organizationId: string;
  organizationName: string;
  subscriptionId: string | null;
  planCode: string | null;
  amountArs: number;
  currencyId: string;
  status: PlatformAdminPaymentStatus;
  provider: string;
  providerPaymentReference: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export type PlatformAdminAuditScalar = string | number | boolean | null;

export interface PlatformAdminAuditDto {
  id: string;
  actorUserId: string | null;
  actorAlias: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  previousState: Record<string, PlatformAdminAuditScalar> | null;
  nextState: Record<string, PlatformAdminAuditScalar> | null;
  result: 'success' | 'partial' | 'failure';
  requestId: string;
  createdAt: string;
}

export interface PlatformAdminPriceChangeBatchDto {
  id: string;
  planCode: string;
  previousAmountArs: number;
  nextAmountArs: number;
  previousPriceVersion: number;
  nextPriceVersion: number;
  status: PlatformAdminPriceBatchStatus;
  eligibleCount: number;
  pendingCount: number;
  processingCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  actorUserId: string;
  actorAlias: string;
  reason: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface PlatformAdminPriceChangeItemDto {
  id: string;
  batchId: string;
  organizationId: string;
  organizationName: string | null;
  subscriptionId: string;
  itemType: PlatformAdminPriceItemType;
  status: PlatformAdminPriceItemStatus;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  processedAt: string | null;
  updatedAt: string;
}

export interface PlatformAdminPriceChangeStatusDto {
  batch: PlatformAdminPriceChangeBatchDto | null;
  items: PlatformAdminListResponse<PlatformAdminPriceChangeItemDto>;
  counts: Partial<Record<PlatformAdminPriceItemStatus, number>>;
}

export interface PlatformAdminSubscriptionsResponse
  extends PlatformAdminListResponse<PlatformAdminSubscriptionDto> {
  plans: PlatformAdminPlanDto[];
}

export interface PlatformAdminQueryResponseMap {
  overview: PlatformAdminOverviewDto;
  organizations: PlatformAdminListResponse<PlatformAdminOrganizationDto>;
  users: PlatformAdminListResponse<PlatformAdminUserDto>;
  subscriptions: PlatformAdminSubscriptionsResponse;
  payments: PlatformAdminListResponse<PlatformAdminPaymentDto>;
  audit: PlatformAdminListResponse<PlatformAdminAuditDto>;
  price_change_status: PlatformAdminPriceChangeStatusDto;
}

export interface PlatformAdminOrganizationFilters {
  planCode?: string;
  accessStatus?: PlatformAdminAccessStatus;
  isEnabled?: boolean;
}

export interface PlatformAdminUserFilters {
  organizationId?: string;
  role?: PlatformAdminTenantRole;
  activity?: 'mau30' | 'inactive';
  status?: PlatformAdminUserDto['status'];
}

export interface PlatformAdminSubscriptionFilters {
  organizationId?: string;
  planCode?: string;
  status?: PlatformAdminSubscriptionStatus;
}

export interface PlatformAdminPaymentFilters {
  organizationId?: string;
  planCode?: string;
  status?: PlatformAdminPaymentStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface PlatformAdminAuditFilters {
  actorUserId?: string;
  action?: string;
  result?: PlatformAdminAuditDto['result'];
  dateFrom?: string;
  dateTo?: string;
}

export interface PlatformAdminPriceStatusFilters {
  batchId?: string;
  planCode?: string;
  itemStatus?: PlatformAdminPriceItemStatus;
  itemType?: PlatformAdminPriceItemType;
}

export interface PlatformAdminQueryFiltersMap {
  overview: Record<string, never>;
  organizations: PlatformAdminOrganizationFilters;
  users: PlatformAdminUserFilters;
  subscriptions: PlatformAdminSubscriptionFilters;
  payments: PlatformAdminPaymentFilters;
  audit: PlatformAdminAuditFilters;
  price_change_status: PlatformAdminPriceStatusFilters;
}

export type PlatformAdminQueryParams<K extends PlatformAdminOperation> =
  K extends 'overview'
    ? { filters?: PlatformAdminQueryFiltersMap[K] }
    : PlatformAdminPagination & {
        search?: string;
        filters?: PlatformAdminQueryFiltersMap[K];
        sort?: PlatformAdminSort;
      };

export type PlatformAdminQueryRequest<K extends PlatformAdminOperation> =
  PlatformAdminQueryParams<K> & { operation: K };

export interface PlatformAdminPricePreviewInput {
  planCode: string;
}

export interface PlatformAdminPricePreviewResponse {
  plan: PlatformAdminPlanDto;
  impact: {
    eligibleActiveRenewals: number;
    pendingCheckouts: number;
    excluded: number;
    totalAffected: number;
  };
  exclusions: Array<{
    reason: string;
    count: number;
  }>;
}

export interface PlatformAdminPriceApplyInput {
  planCode: string;
  newAmountArs: number;
  expectedAmountArs: number;
  expectedPriceVersion: number;
  expectedUpdatedAt: string;
  reason: string;
  password: string;
}

export interface PlatformAdminPriceApplyResponse {
  batch: PlatformAdminPriceChangeBatchDto;
  plan: PlatformAdminPlanDto;
}

export interface PlatformAdminPriceProcessInput {
  batchId: string;
}

export interface PlatformAdminPriceProcessResponse {
  batch: PlatformAdminPriceChangeBatchDto;
  processed: number;
  hasMore: boolean;
}

export interface PlatformAdminPriceRetryInput {
  batchId: string;
  itemIds?: string[];
}

export interface PlatformAdminPriceRetryResponse {
  batch: PlatformAdminPriceChangeBatchDto;
  reopened: number;
}

export type PlatformAdminPriceChangeRequest =
  | ({ action: 'preview' } & PlatformAdminPricePreviewInput)
  | ({ action: 'apply' } & PlatformAdminPriceApplyInput)
  | ({ action: 'process' } & PlatformAdminPriceProcessInput)
  | ({ action: 'retry' } & PlatformAdminPriceRetryInput);

export interface PlatformAdminPriceChangeResponseMap {
  preview: PlatformAdminPricePreviewResponse;
  apply: PlatformAdminPriceApplyResponse;
  process: PlatformAdminPriceProcessResponse;
  retry: PlatformAdminPriceRetryResponse;
}
