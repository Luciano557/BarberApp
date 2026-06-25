import { Clock } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';
import { PLAN_LABELS, resolveEffectivePlan } from '@/lib/planAccess';

export function AppPanelHeader() {
  const { organization } = useOrganization();
  const { access } = useSubscriptionAccess();
  const effectivePlan = resolveEffectivePlan(access, organization?.plan);
  const isPremium = effectivePlan === 'premium';
  const daysUntilBillingEnds = access?.days_until_access_ends ?? null;
  const showBillingNotice =
    access?.has_access === true &&
    daysUntilBillingEnds !== null &&
    daysUntilBillingEnds > 0 &&
    daysUntilBillingEnds <= 3;

  return (
    <div className="mb-6 flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-primary">
          <img src="/favicon.png" alt="Vittro" className="h-6 w-6 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {organization?.name || 'Barberia'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Vittro</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <span
          className={
            isPremium
              ? 'inline-flex items-center rounded-full bg-[#C39A45] px-2 py-0.5 text-[10px] font-semibold text-white'
              : 'inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground'
          }
        >
          {PLAN_LABELS[effectivePlan]}
        </span>
        {showBillingNotice && (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-medium text-status-warning-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            {daysUntilBillingEnds === 1 ? 'Vence en 1 dia' : `Vence en ${daysUntilBillingEnds} dias`}
          </span>
        )}
      </div>
    </div>
  );
}
