import { useSyncExternalStore, type ComponentProps } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { isFinanceDemoActive, subscribeFinanceDemo } from '@/lib/financeDemoRuntime';

/** The global toaster lives outside tenant providers; protect it through the runtime gate. */
export function FinanceDemoToaster(props: ComponentProps<typeof Toaster>) {
  const protectedMode = useSyncExternalStore(subscribeFinanceDemo, isFinanceDemoActive, () => false);
  return protectedMode ? null : <Toaster {...props} />;
}
