import { useEffect, useState } from 'react';
import { BREAKPOINTS } from '@/lib/breakpoints';

/**
 * Lectura de los modos de ventana de Vittro (Compact / Medium / Expanded,
 * DESIGN.md → Layout) para los casos en los que una API de JS no puede
 * expresar la decisión mediante CSS (Radix `side`/`align`, el filtro de
 * pasos de onboarding, el cierre automático del drawer de navegación al
 * navegar en Compact). El layout en sí — ancho, posición y visibilidad del
 * shell — se decide con media queries de Tailwind, no leyendo este hook.
 */
export type WindowMode = 'compact' | 'medium' | 'expanded';

function computeMode(): WindowMode {
  if (typeof window === 'undefined') return 'expanded';
  const w = window.innerWidth;
  if (w < BREAKPOINTS.sm) return 'compact';
  if (w < BREAKPOINTS.lg) return 'medium';
  return 'expanded';
}

export function useWindowMode(): WindowMode {
  const [mode, setMode] = useState<WindowMode>(computeMode);

  useEffect(() => {
    const mqSm = window.matchMedia(`(min-width: ${BREAKPOINTS.sm}px)`);
    const mqLg = window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`);
    const update = () => setMode(computeMode());
    mqSm.addEventListener('change', update);
    mqLg.addEventListener('change', update);
    update();
    return () => {
      mqSm.removeEventListener('change', update);
      mqLg.removeEventListener('change', update);
    };
  }, []);

  return mode;
}
