import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useScrollAffordance } from "@/hooks/use-scroll-affordance";
import { NavOverflowControls } from "@/components/ui/NavOverflowControls";
import { revealInStrip } from "@/lib/nav-strip";
import { cn } from "@/lib/utils";

export interface SectionNavItem {
  id: string;
  label: string;
  /** Efecto a correr antes de desplazar (ej. abrir un Collapsible cerrado que contiene la sección). */
  onBeforeScroll?: () => void;
}

interface SectionNavProps {
  items: SectionNavItem[];
  className?: string;
}

/**
 * Navegación horizontal dentro de una página larga cuyo contenido ya está
 * montado (desplaza a una sección existente — no cambia contenido, eso es
 * Tabs). Responde al espacio real de su propia fila, no a un breakpoint: no
 * desaparece en Compact, solo se vuelve desplazable si no entra. Misma
 * afordancia de continuidad que `TabsList variant="underline"`
 * (`useScrollAffordance`) — DESIGN.md → Layout, "Overflow y reflow".
 *
 * Cuando no entra en una fila, `NavOverflowControls` suma flechas que paginan la
 * tira (no cambian de sección). El activo y el destino enfocado por teclado se
 * mantienen completos y fuera de las flechas.
 *
 * Sabe en qué sección está el usuario: un `IntersectionObserver` mide contra
 * el DOM real, con `rootMargin` superior igual a la altura ya renderizada de
 * este propio `<nav>` (medida, no una constante mágica) — así una sección
 * cuenta como "entrada" recién cuando libera el borde inferior de la tira
 * sticky, no cuando su borde topa el límite físico del viewport.
 */
export function SectionNav({ items, className }: SectionNavProps) {
  const { ref: stripRef, canScrollStart, canScrollEnd } = useScrollAffordance<HTMLDivElement>({ observeContent: true });
  const stripId = useId();
  const navRef = useRef<HTMLElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemIds = items.map((item) => item.id).join(",");

  // Scroll-spy: qué sección ocupa la franja de lectura justo debajo de la tira sticky.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !itemIds) return;

    const sections = itemIds
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const navHeight = nav.getBoundingClientRect().height;
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // El activo es el último en orden de documento que sigue en la franja
        // de lectura — mismo criterio que un scroll-spy convencional.
        for (let i = sections.length - 1; i >= 0; i--) {
          if (visible.has(sections[i].id)) {
            setActiveId(sections[i].id);
            break;
          }
        }
      },
      { rootMargin: `-${Math.ceil(navHeight)}px 0px -60% 0px`, threshold: 0 },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [itemIds]);

  // Lleva el ítem activo al área útil de la tira (completo y fuera de las
  // flechas) — solo `scrollLeft` de la tira, nunca el scroll de la página.
  useEffect(() => {
    const strip = stripRef.current;
    if (!activeId || !strip) return;
    const button = strip.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(activeId)}"]`);
    if (button) revealInStrip(strip, button, "sm");
  }, [activeId, stripRef]);

  const getFallbackFocus = useCallback(
    () =>
      stripRef.current?.querySelector<HTMLElement>('[aria-current="location"]') ??
      stripRef.current?.querySelector<HTMLElement>("[data-section-id]") ??
      null,
    [stripRef],
  );

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      ref={navRef}
      className={cn(
        "sticky top-0 z-10 border-b border-border/60 bg-background/95 py-2 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <NavOverflowControls
        stripRef={stripRef}
        stripId={stripId}
        canScrollStart={canScrollStart}
        canScrollEnd={canScrollEnd}
        labels={{ start: "Mostrar secciones anteriores", end: "Mostrar secciones siguientes" }}
        targetSelector="[data-section-id]"
        getFallbackFocus={getFallbackFocus}
        size="sm"
      >
        <div
          ref={stripRef}
          id={stripId}
          className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
          onFocusCapture={(event) => {
            // Un ítem enfocado por teclado no puede quedar tapado por una flecha.
            const button = (event.target as HTMLElement).closest<HTMLElement>("[data-section-id]");
            if (button && stripRef.current) revealInStrip(stripRef.current, button, "sm");
          }}
        >
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                data-section-id={item.id}
                aria-current={isActive ? "location" : undefined}
                onClick={() => {
                  setActiveId(item.id);
                  item.onBeforeScroll?.();
                  scrollToSection(item.id);
                }}
                className={cn(
                  "shrink-0 rounded px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </NavOverflowControls>
    </nav>
  );
}
