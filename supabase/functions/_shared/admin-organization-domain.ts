// Pure commercial contracts. No credentials, provider payloads or tenant data.
export const ORGANIZATION_ACTIONS = ['update_details', 'assign_manual_plan', 'extend_trial', 'set_trial_end'] as const;
export type OrganizationAction = typeof ORGANIZATION_ACTIONS[number];
export type CommercialChanges =
  | { name: string; phone: string | null; address: string | null; contactEmail: string | null }
  | { planCode: 'basico' | 'profesional' | 'premium'; endsAt: string | null }
  | { endsAt: string };
export interface CommercialMutation {
  action: OrganizationAction;
  organizationId: string;
  expectedOrganizationUpdatedAt: string | null;
  expectedSubscriptionUpdatedAt: string | null;
  changes: CommercialChanges;
  reason: string;
  password: string;
}
export class CommercialError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function invalid(): never { throw new CommercialError('INVALID_INPUT', 400, 'Revisá los datos de la operación.'); }
function text(value: unknown, max: number, nullable = false): string | null {
  if (nullable && (value === null || value === '')) return null;
  if (typeof value !== 'string' || value.length > max || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) invalid();
  const result = value.trim();
  if (!result) { if (nullable) return null; invalid(); }
  return result;
}
function timestamp(value: unknown, nullable: boolean): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) invalid();
  // Preserve Postgres microseconds; Date.toISOString() would break CAS.
  return value;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !(key in value))) invalid();
}
export function parseCommercialMutation(value: unknown, now = Date.now()): CommercialMutation {
  if (!record(value)) invalid();
  exactKeys(value, ['action', 'organizationId', 'expectedOrganizationUpdatedAt', 'expectedSubscriptionUpdatedAt', 'changes', 'reason', 'password']);
  if (!ORGANIZATION_ACTIONS.includes(value.action as OrganizationAction) || !isUuid(value.organizationId) || !record(value.changes)) invalid();
  const reason = text(value.reason, 500)!;
  if (reason.length < 10 || typeof value.password !== 'string' || !value.password || value.password.length > 1024) invalid();
  let changes: CommercialChanges;
  if (value.action === 'update_details') {
    exactKeys(value.changes, ['name', 'phone', 'address', 'contactEmail']);
    const contactEmail = text(value.changes.contactEmail, 254, true)?.toLowerCase() ?? null;
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) invalid();
    changes = { name: text(value.changes.name, 120)!, phone: text(value.changes.phone, 40, true), address: text(value.changes.address, 300, true), contactEmail };
  } else {
    const endsAt = timestamp(value.changes.endsAt, value.action === 'assign_manual_plan');
    if (endsAt !== null && value.action !== 'set_trial_end' && Date.parse(endsAt) <= now) invalid();
    if (value.action === 'assign_manual_plan') {
      exactKeys(value.changes, ['planCode', 'endsAt']);
      if (!['basico', 'profesional', 'premium'].includes(String(value.changes.planCode))) invalid();
      changes = { planCode: value.changes.planCode as 'basico' | 'profesional' | 'premium', endsAt };
    } else {
      exactKeys(value.changes, ['endsAt']);
      changes = { endsAt: endsAt! };
    }
  }
  return { action: value.action as OrganizationAction, organizationId: value.organizationId,
    expectedOrganizationUpdatedAt: timestamp(value.expectedOrganizationUpdatedAt, true),
    expectedSubscriptionUpdatedAt: timestamp(value.expectedSubscriptionUpdatedAt, true), changes, reason, password: value.password };
}
export interface CommercialSubscription {
  status: string; provider: string; current_plan_code: string | null;
  effective_plan_code: string; trial_started_at: string | null; trial_ends_at: string | null;
  current_period_start: string | null; current_period_end: string | null;
  last_payment_at: string | null; pending_plan_code: string | null;
  pending_checkout_amount_ars: number | null; pending_checkout_price_version: number | null;
  mercadopago_preapproval_id: string | null; mercadopago_external_reference: string | null;
  mercadopago_status: string | null; mercadopago_init_point: string | null;
  metadata: Record<string, unknown>;
}
export function commercialEligibility(subscription: CommercialSubscription | null, hasInFlight: boolean, hasApprovedPayments: boolean) {
  const metadata = subscription?.metadata ?? {};
  const providerKeys = ['pending_mercadopago_preapproval_id', 'pending_mercadopago_external_reference', 'previous_mercadopago_preapproval_id', 'previous_mercadopago_external_reference'];
  const linked = !!subscription && Boolean(subscription.mercadopago_preapproval_id || subscription.mercadopago_external_reference || subscription.mercadopago_status || subscription.mercadopago_init_point || subscription.pending_plan_code || subscription.pending_checkout_amount_ars !== null || subscription.pending_checkout_price_version !== null || providerKeys.some(key => metadata[key]));
  const blockCode = hasInFlight ? 'OPERATION_IN_PROGRESS' : linked ? 'PROVIDER_RECONCILIATION_REQUIRED' : null;
  const canExtendTrial = !!subscription && !blockCode && !hasApprovedPayments &&
    ['trialing', 'expired'].includes(subscription.status) && !subscription.current_plan_code &&
    !subscription.last_payment_at &&
    (!subscription.current_period_start || subscription.current_period_start === subscription.trial_started_at) &&
    (!subscription.current_period_end || subscription.current_period_end === subscription.trial_ends_at);
  return { canAssignManualPlan: !blockCode, canExtendTrial, canChangeTrialEnd: canExtendTrial, blockCode };
}
export function commercialError(code: string): CommercialError {
  const errors: Record<string, [number, string]> = {
    COMMERCIAL_CONFLICT: [409, 'La barbería cambió. Actualizá la ficha antes de guardar.'],
    COMMERCIAL_REQUEST_CONFLICT: [409, 'El identificador corresponde a otra operación. Verificá el historial.'],
    PROVIDER_RECONCILIATION_REQUIRED: [409, 'Primero hay que reconciliar el vínculo con Mercado Pago. No se modificaron débitos.'],
    OPERATION_IN_PROGRESS: [409, 'Hay una operación de facturación pendiente. Resolvela antes de cambiar el acceso.'],
    TRIAL_EXTENSION_NOT_ALLOWED: [409, 'Solo se puede extender un trial sin reemplazar acceso pago o manual.'],
    TRIAL_CHANGE_NOT_ALLOWED: [409, 'Solo se puede cambiar un trial sin acceso pago, manual ni pagos aprobados. La nueva fecha debe ser distinta.'],
    ORGANIZATION_NOT_FOUND: [404, 'No encontramos la barbería.'],
    PLAN_NOT_AVAILABLE: [409, 'El plan ya no está disponible. Actualizá la ficha.'],
    INVALID_INPUT: [400, 'Revisá los datos de la operación.'],
  };
  const [status, message] = errors[code] ?? [500, 'No pudimos confirmar la operación. Consultá su estado antes de repetirla.'];
  return new CommercialError(errors[code] ? code : 'COMMERCIAL_MUTATION_FAILED', status, message);
}

// Audit existence alone is not evidence of success. Expose only terminal outcomes.
export function commercialAuditOutcome(row: { result_status: string; result_detail?: Record<string, unknown> } | null) {
  if (row?.result_status === 'succeeded') return { status: 'completed', code: null, message: null } as const;
  const error = row?.result_status === 'failed' ? commercialError(String(row.result_detail?.errorCode ?? '')) : null;
  if (error && error.status < 500) return { status: 'failed', code: error.code, message: error.message } as const;
  return { status: 'not_found', code: null, message: null } as const;
}
