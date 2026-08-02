import { useCallback, useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface UseSwipeToCloseOptions {
  /** Generalmente el `open` del drawer/sheet — controla si los listeners están activos. */
  open: boolean;
  /** Cuando es true, un swipe que supera el umbral no cierra directo: se vuelve a translateY(0) y se delega a onAttemptClose (que abre su propia confirmación). */
  isDirty?: boolean;
  /** Callback de cierre "intentado" — típicamente el mismo handler que ya usan la X, el overlay y Escape (ej. handleOpenChange(false)). */
  onAttemptClose: () => void;
  /** Fracción del alto del panel que hay que arrastrar para considerar el swipe como cierre. */
  distanceRatio?: number;
  /** Velocidad mínima (px/ms) para cerrar aunque no se haya llegado a distanceRatio (flick rápido). */
  velocityThreshold?: number;
  /** Movimiento mínimo (px) antes de decidir si el gesto es un swipe vertical o algo más (scroll horizontal, tap, etc). */
  directionalThreshold?: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  resolved: boolean;
  dragging: boolean;
}

const EASE_OUT_QUINT = "var(--ease-out-quint, cubic-bezier(0.23, 1, 0.32, 1))";

/**
 * Swipe-down-to-close para paneles fixed (DrawerForm / SheetContent).
 *
 * Zona "header" (sin ancestro `.overflow-y-auto` dentro del contenedor): cualquier
 * drag vertical hacia abajo arma el gesto sin condiciones.
 * Zona "body" (dentro de un `.overflow-y-auto`): solo arma el gesto si ese
 * contenedor está con scrollTop === 0 en el momento del pointerdown — si no,
 * el evento se deja pasar intacto al scroll nativo (nunca se llama preventDefault).
 *
 * Restringido a pointerType === 'touch': no debe interferir con drag de mouse.
 */
export function useSwipeToClose({
  open,
  isDirty = false,
  onAttemptClose,
  distanceRatio = 0.25,
  velocityThreshold = 0.5,
  directionalThreshold = 8,
}: UseSwipeToCloseOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<DragState | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const snapBack = useCallback(
    (animate: boolean) => {
      const el = containerRef.current;
      if (!el) return;
      if (animate && !prefersReducedMotion) {
        el.style.transition = `transform 200ms ${EASE_OUT_QUINT}`;
        el.style.transform = "";
        window.setTimeout(() => {
          if (el) el.style.transition = "";
        }, 220);
      } else {
        el.style.transition = "none";
        el.style.transform = "";
        el.style.transition = "";
      }
    },
    [prefersReducedMotion],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;

    const findScrollableAncestor = (target: EventTarget | null): HTMLElement | null => {
      let node = target instanceof HTMLElement ? target : null;
      while (node && node !== el) {
        if (node.classList.contains("overflow-y-auto")) return node;
        node = node.parentElement;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || stateRef.current) return;

      const scrollEl = findScrollableAncestor(e.target);
      if (scrollEl && scrollEl.scrollTop > 0) return;

      stateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTime: e.timeStamp,
        resolved: false,
        dragging: false,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s || e.pointerId !== s.pointerId) return;

      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;

      if (!s.resolved) {
        if (Math.abs(dy) < directionalThreshold && Math.abs(dx) < directionalThreshold) return;
        s.resolved = true;
        const isDownwardVertical = dy > 0 && dy > Math.abs(dx) * 1.5;
        if (!isDownwardVertical) return;
        s.dragging = true;
        el.setPointerCapture(e.pointerId);
        el.style.transition = "none";
      }

      if (!s.dragging) return;

      e.preventDefault();
      el.style.transform = `translateY(${Math.max(0, dy)}px)`;
    };

    const finishDrag = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      stateRef.current = null;
      if (!s.dragging) return;

      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }

      const dy = Math.max(0, e.clientY - s.startY);
      const elapsed = Math.max(1, e.timeStamp - s.startTime);
      const velocity = dy / elapsed;
      const height = el.getBoundingClientRect().height || window.innerHeight;
      const shouldClose = dy > height * distanceRatio || velocity > velocityThreshold;

      if (!shouldClose) {
        snapBack(true);
        return;
      }

      if (isDirty) {
        // Hay cambios sin guardar: no cerramos directo, volvemos y delegamos
        // a onAttemptClose (que abre el diálogo de "¿Descartar cambios?").
        snapBack(true);
        onAttemptClose();
        return;
      }

      if (prefersReducedMotion) {
        el.style.transition = "none";
        el.style.transform = `translateY(${height}px)`;
        onAttemptClose();
      } else {
        // Termina la animación de salida nosotros mismos antes de delegar el
        // cierre real, para no pisar el translateY a mitad de camino con la
        // animación de salida (slide-out-to-right) de Radix.
        el.style.transition = `transform 180ms ${EASE_OUT_QUINT}`;
        el.style.transform = `translateY(${height}px)`;
        window.setTimeout(() => onAttemptClose(), 180);
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      stateRef.current = null;
      if (s.dragging) snapBack(false);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", finishDrag);
    el.addEventListener("pointercancel", onPointerCancel);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", finishDrag);
      el.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [open, isDirty, onAttemptClose, distanceRatio, velocityThreshold, directionalThreshold, snapBack, prefersReducedMotion]);

  // Al reabrir, limpiar cualquier transform que haya quedado de un cierre previo.
  useEffect(() => {
    if (open) snapBack(false);
  }, [open, snapBack]);

  return containerRef;
}
