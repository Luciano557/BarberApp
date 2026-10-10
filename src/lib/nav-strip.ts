/**
 * Matemática del desplazamiento de una navegación horizontal de una sola fila
 * (Tabs underline y SectionNav — DESIGN.md → Components → Navigation).
 *
 * Todas las posiciones están en coordenadas de CONTENIDO de la tira (no de
 * viewport): `left`/`right` de un destino no cambian cuando la tira se desplaza.
 * Las flechas se superponen a los bordes sin reservar ancho, así que el "área
 * útil" de un destino es la ventana visible menos el ancho de cada flecha, y
 * cada flecha solo existe si tras el movimiento queda contenido de ese lado.
 */

const EPS = 1;

export interface StripMetrics {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

export interface TargetRect {
  left: number;
  right: number;
}

export interface NavInsets {
  start: number;
  end: number;
}

export type NavDirection = 'start' | 'end';
export type NavControlSize = 'md' | 'sm';

/** Tamaño visual del botón de cada flecha. */
export const NAV_CONTROL_BUTTON_PX: Record<NavControlSize, number> = { md: 28, sm: 24 };
/** Cola del degradé que baja del fondo sólido al contenido. */
export const NAV_CONTROL_TAIL_PX = 12;

/** Ancho total que una flecha visible le quita a la ventana: botón + cola. */
export function navInset(size: NavControlSize): number {
  return NAV_CONTROL_BUTTON_PX[size] + NAV_CONTROL_TAIL_PX;
}

export function navInsets(size: NavControlSize): NavInsets {
  const px = navInset(size);
  return { start: px, end: px };
}

export function maxScrollLeft(m: Pick<StripMetrics, 'clientWidth' | 'scrollWidth'>): number {
  return Math.max(0, m.scrollWidth - m.clientWidth);
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

function snap(value: number, max: number): number {
  if (value <= EPS) return 0;
  if (value >= max - EPS) return max;
  return value;
}

/** Ventana donde un destino se ve completo y sin tapar por una flecha, para un `scrollLeft` dado. */
export function usableRange(scrollLeft: number, m: StripMetrics, insets: NavInsets) {
  const max = maxScrollLeft(m);
  return {
    start: scrollLeft + (scrollLeft > EPS ? insets.start : 0),
    end: scrollLeft + m.clientWidth - (scrollLeft < max - EPS ? insets.end : 0),
  };
}

export function isFullyUsable(target: TargetRect, m: StripMetrics, insets: NavInsets): boolean {
  const u = usableRange(m.scrollLeft, m, insets);
  return target.left >= u.start - EPS && target.right <= u.end + EPS;
}

/**
 * `scrollLeft` que deja `target` completo y fuera de las flechas con el menor
 * movimiento posible. Si ya está en el área útil devuelve el `scrollLeft`
 * actual (no mover).
 */
export function revealScrollLeft(target: TargetRect, m: StripMetrics, insets: NavInsets): number {
  const max = maxScrollLeft(m);
  const current = m.scrollLeft;
  if (isFullyUsable(target, m, insets)) return current;

  const visible = usableRange(current, m, insets);
  let next =
    target.left < visible.start
      ? target.left - insets.start
      : target.right - m.clientWidth + insets.end;
  next = clamp(next, max);

  // Un destino más ancho que el área útil: priorizar su inicio.
  const after = usableRange(next, m, insets);
  if (target.left < after.start - EPS) next = clamp(target.left - insets.start, max);

  return snap(next, max);
}

/**
 * `scrollLeft` de una página de la flecha.
 * - `end`: el primer destino que no está completo a la derecha queda alineado
 *   al inicio del área útil.
 * - `start`: el último destino que no está completo a la izquierda queda
 *   alineado al final del área útil.
 * Nunca un desplazamiento fijo en píxeles, y siempre acotado a los extremos.
 */
export function pageScrollLeft(
  direction: NavDirection,
  m: StripMetrics,
  insets: NavInsets,
  targets: TargetRect[],
): number {
  const max = maxScrollLeft(m);
  const current = m.scrollLeft;
  const usable = usableRange(current, m, insets);
  const usableWidth = Math.max(1, m.clientWidth - insets.start - insets.end);

  if (direction === 'end') {
    const first = targets.find((t) => t.right > usable.end + EPS);
    if (!first) return max;
    let next = clamp(first.left - insets.start, max);
    if (next <= current + EPS && current < max - EPS) next = clamp(current + usableWidth, max);
    return snap(next, max);
  }

  let last: TargetRect | undefined;
  for (const t of targets) if (t.left < usable.start - EPS) last = t;
  if (!last) return 0;
  let next = clamp(last.right - m.clientWidth + insets.end, max);
  if (next >= current - EPS && current > EPS) next = clamp(current - usableWidth, max);
  return snap(next, max);
}

/** `smooth` salvo que el usuario pidió reducir movimiento (la regla global de CSS no cubre el scroll). */
export function scrollBehaviorFor(prefersReducedMotion: boolean): 'auto' | 'smooth' {
  return prefersReducedMotion ? 'auto' : 'smooth';
}

/**
 * Un tab activo cambió de verdad: pasó de cualquier otro valor a `active`.
 * Cualquier otra mutación del `tablist` no debe mover la tira.
 */
export function isTabActivation(oldValue: string | null, newValue: string | null): boolean {
  return newValue === 'active' && oldValue !== 'active';
}

export type FocusHandoff = 'start' | 'end' | 'active';

/**
 * Si la flecha que tenía el foco dejó de mostrarse: pasa a la opuesta si existe,
 * y si no queda ninguna (todo entra), al destino activo. `null` = no hace falta.
 */
export function resolveFocusHandoff(
  focusedSide: NavDirection | null,
  canScrollStart: boolean,
  canScrollEnd: boolean,
): FocusHandoff | null {
  if (focusedSide === 'start' && !canScrollStart) return canScrollEnd ? 'end' : 'active';
  if (focusedSide === 'end' && !canScrollEnd) return canScrollStart ? 'start' : 'active';
  return null;
}

/* ─── Lectura/escritura del DOM (usadas por Tabs, SectionNav y NavOverflowControls) ─── */

export function readStripMetrics(strip: HTMLElement): StripMetrics {
  return { scrollLeft: strip.scrollLeft, clientWidth: strip.clientWidth, scrollWidth: strip.scrollWidth };
}

export function readTargetRect(strip: HTMLElement, target: HTMLElement): TargetRect {
  const s = strip.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const offset = strip.scrollLeft - strip.clientLeft;
  return { left: t.left - s.left + offset, right: t.right - s.left + offset };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Mueve únicamente `scrollLeft` de la tira: nunca el scroll vertical de la página. */
export function scrollStripTo(strip: HTMLElement, left: number, options: { instant?: boolean } = {}) {
  if (Math.abs(left - strip.scrollLeft) < EPS) return;
  const behavior = options.instant ? 'auto' : scrollBehaviorFor(prefersReducedMotion());
  if (typeof strip.scrollTo === 'function') strip.scrollTo({ left, behavior });
  else strip.scrollLeft = left;
}

/** Lleva `target` al área útil de la tira. No hace nada si ya está o si la tira no tiene layout. */
export function revealInStrip(
  strip: HTMLElement,
  target: HTMLElement,
  size: NavControlSize,
  options: { instant?: boolean } = {},
) {
  if (strip.clientWidth === 0) return;
  const next = revealScrollLeft(readTargetRect(strip, target), readStripMetrics(strip), navInsets(size));
  scrollStripTo(strip, next, options);
}
