import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  NAV_CONTROL_BUTTON_PX,
  navInset,
  navInsets,
  pageScrollLeft,
  readStripMetrics,
  readTargetRect,
  resolveFocusHandoff,
  scrollStripTo,
  type NavControlSize,
  type NavDirection,
} from "@/lib/nav-strip";

interface NavOverflowControlsProps {
  /** Tira scrolleable (la misma que mide `useScrollAffordance`). Va como hijo, entre las dos flechas. */
  children: React.ReactNode;
  stripRef: React.RefObject<HTMLElement>;
  stripId: string;
  canScrollStart: boolean;
  canScrollEnd: boolean;
  labels: { start: string; end: string };
  /** Selector de los destinos dentro de la tira (definen a dónde pagina cada flecha). */
  targetSelector: string;
  /** A dónde va el foco si desaparece la flecha enfocada y no queda ninguna. */
  getFallbackFocus: () => HTMLElement | null;
  size?: NavControlSize;
  /** Px de la caja de la tira que quedan fuera de la fila del control (padding/subrayado de Tabs). */
  bottomInset?: number;
}

/**
 * Controles direccionales de una navegación horizontal de una sola fila
 * (Tabs underline y SectionNav — DESIGN.md → Components → Navigation).
 * Solo desplazan la tira: NO activan destinos. Orden DOM = orden de foco:
 * flecha izquierda → tira → flecha derecha, sin tabindex. Van superpuestas
 * (absolute) al borde de la tira y no reservan ancho; se ocultan cuando no
 * queda contenido de ese lado. El degradé es solo el fondo del control.
 */
export function NavOverflowControls({
  children,
  stripRef,
  stripId,
  canScrollStart,
  canScrollEnd,
  labels,
  targetSelector,
  getFallbackFocus,
  size = "md",
  bottomInset = 0,
}: NavOverflowControlsProps) {
  const startRef = React.useRef<HTMLButtonElement>(null);
  const endRef = React.useRef<HTMLButtonElement>(null);
  const focusedSide = React.useRef<NavDirection | null>(null);
  const [box, setBox] = React.useState<{ top: number; height: number } | null>(null);

  // La tira puede tener margen propio (ej. `mb-6` de Finanzas) que agranda el
  // contenedor: los controles se alinean a la caja real de la tira, no a la del wrapper.
  React.useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = () => {
      const next = { top: strip.offsetTop, height: strip.offsetHeight };
      setBox((prev) => (prev && prev.top === next.top && prev.height === next.height ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [stripRef]);

  // Si la flecha enfocada deja de mostrarse (llegó al extremo, o ya todo entra),
  // el foco no se pierde: pasa a la opuesta o al destino activo.
  React.useEffect(() => {
    const handoff = resolveFocusHandoff(focusedSide.current, canScrollStart, canScrollEnd);
    if (!handoff) return;
    if (document.activeElement && document.activeElement !== document.body) {
      focusedSide.current = null;
      return;
    }
    const next =
      handoff === "start" ? startRef.current : handoff === "end" ? endRef.current : getFallbackFocus();
    next?.focus();
    if (handoff === "active") focusedSide.current = null;
  }, [canScrollStart, canScrollEnd, getFallbackFocus]);

  const page = (direction: NavDirection) => {
    const strip = stripRef.current;
    if (!strip) return;
    const targets = Array.from(strip.querySelectorAll<HTMLElement>(targetSelector)).map((el) =>
      readTargetRect(strip, el),
    );
    scrollStripTo(strip, pageScrollLeft(direction, readStripMetrics(strip), navInsets(size), targets));
  };

  const control = (side: NavDirection) => {
    const isStart = side === "start";
    const Icon = isStart ? ChevronLeft : ChevronRight;
    const button = NAV_CONTROL_BUTTON_PX[size];
    return (
      <div
        className={cn("pointer-events-none absolute z-10 flex items-center", isStart ? "left-0 justify-start" : "right-0 justify-end")}
        style={{
          top: box?.top ?? 0,
          height: box ? Math.max(0, box.height - bottomInset) : "100%",
          width: navInset(size),
          // Sólido detrás del botón; la cola baja hacia el contenido. Token de fondo, sin color nuevo.
          backgroundImage: `linear-gradient(to ${isStart ? "right" : "left"}, hsl(var(--background)) ${button}px, transparent)`,
        }}
      >
        <button
          ref={isStart ? startRef : endRef}
          type="button"
          aria-label={isStart ? labels.start : labels.end}
          aria-controls={stripId}
          onClick={() => page(side)}
          onFocus={() => {
            focusedSide.current = side;
          }}
          onBlur={(event) => {
            // Blur hacia otro elemento, o clic en una zona no enfocable (el botón sigue en el DOM).
            if (event.relatedTarget || event.currentTarget.isConnected) focusedSide.current = null;
          }}
          className="hit-area-expand pointer-events-auto grid place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
          style={{ width: button, height: button }}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  };

  return (
    <div className="relative">
      {canScrollStart && control("start")}
      {children}
      {canScrollEnd && control("end")}
    </div>
  );
}
