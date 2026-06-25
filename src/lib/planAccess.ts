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

export interface PlanBenefit {
  title: string;
  description: string;
}

export const PLAN_SUMMARY: Record<BillingPlanCode, string> = {
  basico: 'Para operar el dia a dia con cobros y caja ordenados.',
  profesional: 'Para sumar agenda, clientes y control de sueldos.',
  premium: 'Para ver el negocio completo y gestionar decisiones avanzadas.',
};

export const PLAN_BENEFITS: Record<BillingPlanCode, PlanBenefit[]> = {
  basico: [
    {
      title: 'Cobrar',
      description: 'Registro de servicios, productos, descuentos y metodos de pago.',
    },
    {
      title: 'Caja diaria',
      description: 'Resumen de cobros, cierres y movimientos del dia.',
    },
    {
      title: 'Operacion base',
      description: 'Acceso mensual para que el equipo trabaje sin planillas.',
    },
  ],
  profesional: [
    {
      title: 'Todo Basico',
      description: 'Mantiene cobros, caja y operacion diaria.',
    },
    {
      title: 'Turnos',
      description: 'Agenda, disponibilidad, bloqueos y reservas por sucursal.',
    },
    {
      title: 'Clientes',
      description: 'Base de clientes con datos de contacto e historial.',
    },
    {
      title: 'Sueldos',
      description: 'Consulta y registro de sueldos del equipo.',
    },
  ],
  premium: [
    {
      title: 'Todo Profesional',
      description: 'Incluye agenda, clientes y sueldos.',
    },
    {
      title: 'Estadisticas',
      description: 'Facturacion, servicios, ticket promedio y rendimiento mensual.',
    },
    {
      title: 'Finanzas avanzadas',
      description: 'Gastos, inversiones y deudas en un solo lugar.',
    },
    {
      title: 'Tareas y peticiones',
      description: 'Asignaciones internas, recurrencias y seguimiento operativo.',
    },
  ],
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
