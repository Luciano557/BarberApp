import { useEffect, useState } from 'react';

export interface ProgressiveLoadingState {
  delayed: boolean; // 8s
  showRetry: boolean; // 25s
  fatal: boolean; // 90s
}

/**
 * Red de seguridad UX para loaders largos.
 * NO sustituye corregir la causa real del bloqueo: solo permite que el usuario
 * tenga feedback y pueda reintentar manualmente si algo se demora demasiado.
 *
 * Umbrales:
 * - 8s  → mensaje "Esto está tardando más de lo normal..."
 * - 25s → botón "Reintentar"
 * - 90s → pantalla recuperable completa
 */
export function useProgressiveLoading(active: boolean): ProgressiveLoadingState {
  const [state, setState] = useState<ProgressiveLoadingState>({
    delayed: false,
    showRetry: false,
    fatal: false,
  });

  useEffect(() => {
    if (!active) {
      setState({ delayed: false, showRetry: false, fatal: false });
      return;
    }
    const t1 = setTimeout(() => setState(s => ({ ...s, delayed: true })), 8000);
    const t2 = setTimeout(() => setState(s => ({ ...s, showRetry: true })), 25000);
    const t3 = setTimeout(() => setState(s => ({ ...s, fatal: true })), 90000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active]);

  return state;
}
