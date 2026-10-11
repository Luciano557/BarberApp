import type { PlatformAdminCommercialAction } from '@/types/platformAdmin';

interface PendingCommercialOperation { requestId: string; action: PlatformAdminCommercialAction }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const key = (actor: string, organization: string) => `vittro:admin-commercial:${actor}:${organization}`;
// Only the stable ID/action, never a password, form body, email or contact data.
export function readCommercialRecovery(actor: string, organization: string): PendingCommercialOperation | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key(actor, organization)) ?? 'null');
    return parsed && uuid.test(parsed.requestId) && ['update_details', 'assign_manual_plan', 'extend_trial', 'set_trial_end'].includes(parsed.action) ? parsed : null;
  } catch { return null; }
}
export function rememberCommercialOperation(actor: string, organization: string, operation: PendingCommercialOperation) {
  // Storage failure is surfaced BEFORE the write, so recovery is never silently lost.
  sessionStorage.setItem(key(actor, organization), JSON.stringify({ requestId: operation.requestId, action: operation.action }));
}
export function clearCommercialRecovery(actor: string, organization: string) { sessionStorage.removeItem(key(actor, organization)); }
