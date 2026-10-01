import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { isFinanceDemoActive } from '@/lib/financeDemoRuntime';

export interface OperationalReadOptions { enabled?: boolean }

/** Aborts reads on disable/unmount and closes stale callbacks before they hit Supabase. */
export function useOperationalAccess(enabled: boolean) {
  const enabledRef = useRef(enabled);
  const controllers = useRef(new Set<AbortController>());
  useLayoutEffect(() => {
    enabledRef.current = enabled;
    const activeControllers = controllers.current;
    return () => {
      enabledRef.current = false;
      activeControllers.forEach(controller => controller.abort());
      activeControllers.clear();
    };
  }, [enabled]);
  const allowed = useCallback(() => enabledRef.current && !isFinanceDemoActive(), []);
  const start = useCallback(() => {
    const controller = new AbortController();
    controllers.current.add(controller);
    return {
      signal: controller.signal,
      current: () => allowed() && !controller.signal.aborted,
      finish: () => controllers.current.delete(controller),
    };
  }, [allowed]);
  return useMemo(() => ({ allowed, start }), [allowed, start]);
}
