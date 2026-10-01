import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';
import { createFinanceDemoData } from '@/lib/financeDemoData';
import { canActivateFinanceDemo, setFinanceDemoActive } from '@/lib/financeDemoRuntime';

export const FINANCE_DEMO_STORAGE_KEY = 'vittro:finance-demo:v1';
interface SavedDemo { identity: string; branch: string | null; referenceDate: string }
function readSaved(): SavedDemo | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(FINANCE_DEMO_STORAGE_KEY) ?? 'null');
    if (value && typeof value === 'object' && 'identity' in value && 'branch' in value && 'referenceDate' in value) {
      const saved = value as SavedDemo;
      if (typeof saved.identity === 'string' && (saved.branch === null || ['demo-centro', 'demo-norte'].includes(saved.branch)) && Number.isFinite(new Date(saved.referenceDate).getTime())) return saved;
    }
  } catch { /* A damaged entry never supplies identities or data. */ }
  return null;
}
const EMPTY_DATA = createFinanceDemoData(new Date(), null);
const FinanceDemoContext = createContext({
  active: false, data: EMPTY_DATA, branch: null as string | null,
  activate: (): boolean => false, setBranch: (_branch: string | null) => {},
  requestExit: (_action?: () => void) => {}, confirmExit: () => {}, cancelExit: () => {}, exitPending: false,
});

export function FinanceDemoProvider({ children }: { children: ReactNode }) {
  const { user, isOwner, isGeneralManager, isLoading: authLoading } = useAuth();
  const { organization, isLoading: orgLoading } = useOrganization();
  const [saved, setSaved] = useState<SavedDemo | null>(readSaved);
  const [exitAction, setExitAction] = useState<{ run: () => void } | null>(null);
  const identity = user && organization ? `${user.id}:${organization.id}` : null;
  const active = !!identity && saved?.identity === identity;
  const restoring = !!saved && (authLoading || orgLoading);
  const branch = isOwner || isGeneralManager ? saved?.branch ?? null : 'demo-centro';
  const data = useMemo(() => createFinanceDemoData(new Date(saved?.referenceDate ?? Date.now()), branch), [saved?.referenceDate, branch]);

  useLayoutEffect(() => {
    setFinanceDemoActive(active || restoring);
    if (active || restoring) toast.dismiss();
    return () => setFinanceDemoActive(false);
  }, [active, restoring]);
  useLayoutEffect(() => {
    if (!authLoading && !orgLoading && saved && saved.identity !== identity) {
      try { sessionStorage.removeItem(FINANCE_DEMO_STORAGE_KEY); } catch { /* Identity changes still clear the in-memory mode. */ }
      setSaved(null);
      setExitAction(null);
    }
  }, [identity, authLoading, orgLoading, saved]);

  const activate = useCallback(() => {
    if (!identity) return false;
    if (!canActivateFinanceDemo()) {
      toast.error('Esperá a que termine la operación en curso.');
      return false;
    }
    const next: SavedDemo = { identity, branch: isOwner || isGeneralManager ? null : 'demo-centro', referenceDate: new Date().toISOString() };
    try { sessionStorage.setItem(FINANCE_DEMO_STORAGE_KEY, JSON.stringify(next)); }
    catch { toast.error('No pudimos activar los datos ficticios en este navegador.'); return false; }
    // Close stale callbacks synchronously, before React commits the replacement panels.
    setFinanceDemoActive(true);
    toast.dismiss();
    setSaved(next);
    return true;
  }, [identity, isOwner, isGeneralManager]);
  const setBranch = useCallback((branch: string | null) => {
    if (!active || !saved || (branch !== null && !['demo-centro', 'demo-norte'].includes(branch))) return;
    const next = { ...saved, branch };
    try { sessionStorage.setItem(FINANCE_DEMO_STORAGE_KEY, JSON.stringify(next)); }
    catch { toast.error('No pudimos guardar la selección.'); return; }
    setSaved(next);
  }, [active, saved]);
  const requestExit = useCallback((action: () => void = () => {}) => {
    if (!active) { action(); return; }
    setExitAction({ run: action });
  }, [active]);
  const confirmExit = useCallback(() => {
    try { sessionStorage.removeItem(FINANCE_DEMO_STORAGE_KEY); }
    catch { toast.error('No pudimos desactivar los datos ficticios.'); return; }
    setFinanceDemoActive(false);
    setSaved(null);
    setExitAction(null);
    exitAction?.run();
  }, [exitAction]);
  return <FinanceDemoContext.Provider value={{ active, data, branch, activate, setBranch, requestExit, confirmExit, cancelExit: () => setExitAction(null), exitPending: active && !!exitAction }}>{children}</FinanceDemoContext.Provider>;
}

export const useFinanceDemo = () => useContext(FinanceDemoContext);
