import { useCallback, useRef, useState } from 'react';

export interface PointerDragGhost<T> {
  item: T;
  x: number;
  y: number;
  label?: string;
}

interface Options<T> {
  enabled: boolean;
  longPressMs?: number;
  moveThresholdPx?: number;
  canDragItem?: (item: T) => boolean;
  onTap: (item: T) => void;
  onDrop: (item: T, x: number, y: number) => void;
  buildGhostLabel?: (item: T, x: number, y: number) => string | undefined;
}

interface ActiveState<T> {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  startTime: number;
  item: T;
  dragging: boolean;
  el: HTMLElement;
}

/**
 * Pointer-events based drag-and-drop that works on mouse, touch and stylus.
 * - Mouse: drag starts immediately on movement.
 * - Touch/stylus: long-press (>= longPressMs) + movement (>= moveThresholdPx) starts the drag.
 * - If the gesture ends without dragging, fires onTap.
 */
export function usePointerDragDrop<T>(opts: Options<T>) {
  const {
    enabled,
    longPressMs = 200,
    moveThresholdPx = 6,
    canDragItem,
    onTap,
    onDrop,
    buildGhostLabel,
  } = opts;

  const activeRef = useRef<ActiveState<T> | null>(null);
  const [ghost, setGhost] = useState<PointerDragGhost<T> | null>(null);

  const cleanup = useCallback(() => {
    const a = activeRef.current;
    if (a) {
      try { a.el.releasePointerCapture?.(a.pointerId); } catch { /* noop */ }
    }
    activeRef.current = null;
    setGhost(null);
  }, []);

  const getHandlers = useCallback((item: T) => {
    const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
      // Ignore secondary pointers / non-primary mouse buttons
      if (e.button !== undefined && e.button !== 0) return;
      if (activeRef.current) return; // already a gesture in progress
      const el = e.currentTarget as HTMLElement;
      try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
      activeRef.current = {
        pointerId: e.pointerId,
        pointerType: e.pointerType || 'mouse',
        startX: e.clientX,
        startY: e.clientY,
        startTime: Date.now(),
        item,
        dragging: false,
        el,
      };
    };

    const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
      const a = activeRef.current;
      if (!a || a.pointerId !== e.pointerId) return;
      const dx = e.clientX - a.startX;
      const dy = e.clientY - a.startY;
      const dist = Math.hypot(dx, dy);

      if (!a.dragging) {
        if (dist < moveThresholdPx) return;
        const allowed =
          enabled && (!canDragItem || canDragItem(a.item));
        if (!allowed) return;
        const isMouse = a.pointerType === 'mouse';
        const elapsed = Date.now() - a.startTime;
        if (!isMouse && elapsed < longPressMs) {
          // movement before long-press completed → treat as scroll, abandon gesture
          cleanup();
          return;
        }
        a.dragging = true;
      }

      // Dragging confirmed → block scroll/selection while moving
      if (e.cancelable) e.preventDefault();
      const label = buildGhostLabel?.(a.item, e.clientX, e.clientY);
      setGhost({ item: a.item, x: e.clientX, y: e.clientY, label });
    };

    const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
      const a = activeRef.current;
      if (!a || a.pointerId !== e.pointerId) return;
      const wasDragging = a.dragging;
      const itemRef = a.item;
      const x = e.clientX;
      const y = e.clientY;
      cleanup();
      if (wasDragging) {
        onDrop(itemRef, x, y);
      } else {
        onTap(itemRef);
      }
    };

    const onPointerCancel = (e: React.PointerEvent<HTMLElement>) => {
      const a = activeRef.current;
      if (!a || a.pointerId !== e.pointerId) return;
      cleanup();
    };

    const onContextMenu = (e: React.MouseEvent<HTMLElement>) => {
      // Avoid native long-press context menu while we own the gesture
      if (activeRef.current) e.preventDefault();
    };

    const onDragStart = (e: React.DragEvent<HTMLElement>) => {
      // Block native HTML5 drag (e.g. image/text) on these elements
      e.preventDefault();
    };

    return {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onContextMenu,
      onDragStart,
    };
  }, [enabled, longPressMs, moveThresholdPx, canDragItem, onTap, onDrop, buildGhostLabel, cleanup]);

  return { getHandlers, ghost };
}

/**
 * Pointer-based "tap" detector for empty slots / clickable areas where we want a
 * reliable tap on touch (avoiding the 300ms delay and cases where onClick is swallowed).
 */
export function usePointerTap(onTap: (e: React.PointerEvent<HTMLElement>) => void, moveThresholdPx = 6) {
  const ref = useRef<{ id: number; x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    ref.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const a = ref.current;
    ref.current = null;
    if (!a || a.id !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - a.x, e.clientY - a.y);
    if (dist < moveThresholdPx) onTap(e);
  };
  const onPointerCancel = () => { ref.current = null; };

  return { onPointerDown, onPointerUp, onPointerCancel };
}
