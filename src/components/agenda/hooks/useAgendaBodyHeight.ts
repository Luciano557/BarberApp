import { useLayoutEffect, useState, type RefObject } from 'react';

const FLOOR_PX = 240;
const CEILING_PX = 1100;
const BOTTOM_GUTTER_PX = 16;
const FALLBACK_MAX_HEIGHT = 600;

/**
 * Altura del scroller vertical propio de la grilla de Agenda (Día/multi-día).
 *
 * Reemplaza la fórmula anterior `clamp(600px, calc(100vh - 180px), 1100px)`:
 * el piso de 600px asumía que "100vh - 180px" siempre alcanzaba esa cifra, pero
 * en pantallas bajas (375×667, 320×568) ese cálculo da menos de 600px y el piso
 * ganaba igual — la grilla exigía más alto que el espacio real disponible y
 * generaba scroll vertical anidado (el `<main>` del shell, que ya es el único
 * scroller de página real, y el propio `overflow-y-auto` de la grilla,
 * compitiendo entre sí).
 *
 * En vez de adivinar un segundo número fijo, mide en runtime cuánto ocupa
 * realmente lo que va arriba de la grilla (todo lo que hay desde el borde
 * superior de `outerRef` — incluido el propio header sticky de Agenda) y
 * expresa la altura como `calc(100svh - eseOffset - gutter)`: `svh` en vez de
 * `vh` por la misma razón que el resto de C7 (estabilidad frente al chrome
 * móvil dinámico), medición en vez de constante porque el offset real depende
 * de cuánto ocupa el toolbar de `AgendaPanel` — que este mismo build hace
 * capaz de partirse en dos líneas en viewports angostos.
 */
export function useAgendaBodyHeight(
  outerRef: RefObject<HTMLElement>,
  headerRef: RefObject<HTMLElement>,
) {
  const [maxHeight, setMaxHeight] = useState<string | number>(FALLBACK_MAX_HEIGHT);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const header = headerRef.current;
    if (!outer || !header) return;

    const compute = () => {
      const outerTop = Math.max(0, outer.getBoundingClientRect().top);
      const headerHeight = header.getBoundingClientRect().height;
      const offset = outerTop + headerHeight + BOTTOM_GUTTER_PX;
      setMaxHeight(`clamp(${FLOOR_PX}px, calc(100svh - ${offset}px), ${CEILING_PX}px)`);
    };

    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [outerRef, headerRef]);

  return maxHeight;
}
