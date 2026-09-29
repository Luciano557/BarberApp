import { useEffect, useRef, useState } from "react";

interface ScrollAffordanceState {
  canScrollStart: boolean;
  canScrollEnd: boolean;
}

interface ScrollAffordanceOptions {
  /**
   * Opt-in de las navegaciones (Tabs underline, SectionNav): además del tamaño
   * del contenedor, observa el CONTENIDO (hijos/texto que cambian sin que cambie
   * el contenedor, ej. sucursales que cargan después) y la carga de fuentes.
   * Apagado por defecto — las tablas comparativas conservan su comportamiento.
   */
  observeContent?: boolean;
}

/**
 * Detecta si una tira horizontal scrolleable tiene contenido oculto a cada lado
 * (Tabs `variant="underline"`, SectionNav, Table comparative — DESIGN.md →
 * Layout, "Overflow y reflow"). Mide con el scroll nativo del propio contenedor
 * (scrollLeft / scrollWidth / clientWidth) — responde a "¿esto entra?", no a un
 * breakpoint. Solo Vittro es LTR: "start"/"end" equivalen a izquierda/derecha.
 */
export function useScrollAffordance<T extends HTMLElement>({ observeContent = false }: ScrollAffordanceOptions = {}) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<ScrollAffordanceState>({
    canScrollStart: false,
    canScrollEnd: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const canScrollStart = scrollLeft > 1;
      const canScrollEnd = scrollLeft + clientWidth < scrollWidth - 1;
      setState((prev) =>
        prev.canScrollStart === canScrollStart && prev.canScrollEnd === canScrollEnd
          ? prev
          : { canScrollStart, canScrollEnd },
      );
    };

    update();
    el.addEventListener("scroll", update, { passive: true });

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    let mutationObserver: MutationObserver | undefined;
    let cancelled = false;
    if (observeContent) {
      mutationObserver = new MutationObserver(update);
      mutationObserver.observe(el, { childList: true, subtree: true, characterData: true });
      // Un cambio de fuente cambia el ancho del contenido sin mutar el DOM.
      void document.fonts?.ready.then(() => {
        if (!cancelled) update();
      });
    }

    return () => {
      cancelled = true;
      el.removeEventListener("scroll", update);
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
    };
  }, [observeContent]);

  return { ref, ...state };
}
