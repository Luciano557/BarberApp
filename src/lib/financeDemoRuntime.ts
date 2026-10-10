// The live contexts keep their real identities. This gate only protects operational work.
let demoActive = false;
let pendingWrites = 0;
const listeners = new Set<() => void>();

export const isFinanceDemoActive = () => demoActive;
export const canActivateFinanceDemo = () => pendingWrites === 0;
export function setFinanceDemoActive(active: boolean) {
  if (demoActive === active) return;
  demoActive = active;
  listeners.forEach(listener => listener());
}
export function subscribeFinanceDemo(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function runFinanceWrite<T>(operation: () => Promise<T>): Promise<T | undefined> {
  if (demoActive) return undefined;
  pendingWrites += 1;
  try { return await operation(); }
  finally { pendingWrites -= 1; }
}
