import type { BillingPlanCode, SubscriptionAccess } from '@/hooks/useSubscriptionAccess';

export type PlanFeatureKey =
  | 'finance.statistics'
  | 'finance.salaries'
  | 'finance.expenses'
  | 'finance.investments'
  | 'finance.debts'
  | 'tasks'
  | 'appointments'
  | 'clients';

export const PLAN_LABELS: Record<BillingPlanCode, string> = {
  basico: 'Basico',
  profesional: 'Profesional',
  premium: 'Premium',
};

const PLAN_RANK: Record<BillingPlanCode, number> = {
  basico: 1,
  profesional: 2,
  premium: 3,
};

export const FEATURE_MIN_PLAN: Record<PlanFeatureKey, BillingPlanCode> = {
  'finance.statistics': 'premium',
  'finance.salaries': 'profesional',
  'finance.expenses': 'premium',
  'finance.investments': 'premium',
  'finance.debts': 'premium',
  tasks: 'premium',
  appointments: 'profesional',
  clients: 'profesional',
};

export function resolveEffectivePlan(
  access: SubscriptionAccess | null | undefined,
  organizationPlan: BillingPlanCode | null | undefined,
): BillingPlanCode {
  return access?.effective_plan_code ?? organizationPlan ?? 'basico';
}

export function planAllowsFeature(
  plan: BillingPlanCode,
  feature: PlanFeatureKey,
): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

export function getRequiredPlan(feature: PlanFeatureKey): BillingPlanCode {
  return FEATURE_MIN_PLAN[feature];
}

export function isFinanceAvailableForPlan(plan: BillingPlanCode): boolean {
  return planAllowsFeature(plan, 'finance.salaries') ||
    planAllowsFeature(plan, 'finance.statistics') ||
    planAllowsFeature(plan, 'finance.expenses') ||
    planAllowsFeature(plan, 'finance.investments') ||
    planAllowsFeature(plan, 'finance.debts');
}
