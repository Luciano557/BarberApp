/**
 * Fuente única de fronteras responsive de Vittro (C7.1 — Fundaciones responsive).
 *
 * `tailwind.config.ts` y cualquier hook de JavaScript que necesite leer una
 * frontera compartida importan estos valores. Las fronteras no vuelven a
 * escribirse a mano en un segundo lugar — ver DESIGN.md → Layout →
 * "Fuente única de breakpoints".
 *
 * BREAKPOINTS declara los cinco breakpoints técnicos de Tailwind
 * (`sm`/`md`/`lg`/`xl`/`2xl`) con sus valores default exactos. Este módulo
 * los CENTRALIZA, no los cambia: antes y después de C7.1, `sm:`, `md:`,
 * `lg:`, `xl:` y `2xl:` siguen significando exactamente lo mismo.
 *
 * WINDOW_MODES describe la macroestructura conceptual de producto —
 * Compact / Medium / Expanded (DESIGN.md → Layout) — y no son un cuarto
 * vocabulario de breakpoints: sus fronteras coinciden con `sm` (640) y
 * `lg` (1024) de BREAKPOINTS. `md` (768), `xl` (1280) y `2xl` (1536) siguen
 * existiendo como utilities de Tailwind para decisiones dentro de una
 * región (una segunda columna, un cambio tipográfico) — no deciden el modo
 * de ventana.
 *
 * Regla de consumo desde JavaScript (DESIGN.md → Layout):
 * el layout se decide mediante CSS. JavaScript puede LEER estas fronteras
 * únicamente cuando una API no pueda expresar ese comportamiento mediante
 * CSS (ejemplos vigentes: `side`/`align` de Radix, el filtro de pasos de
 * onboarding, la presentación Popover/Drawer de los pickers de fecha/hora —
 * ninguno de esos consumidores se migra en C7.1). JavaScript también puede
 * MEDIR el ancho real de su propio contenedor (`ResizeObserver`,
 * `clientWidth`/`scrollWidth`) para responder "¿esto entra?" — eso no es
 * leer un modo de ventana, es una pregunta distinta que depende del
 * contenido, no de un umbral fijo. Lo que JavaScript nunca puede hacer es
 * inventar un número de corte propio, hardcodeado, que no salga de acá.
 */

/** Breakpoints técnicos de Tailwind — valores default, sin cambios. */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/** Los mismos valores con su unidad `px`, listos para `theme.screens` de Tailwind. */
export const BREAKPOINTS_PX: Record<keyof typeof BREAKPOINTS, string> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export type WindowMode = 'compact' | 'medium' | 'expanded';

/**
 * Modos de ventana — macroestructura conceptual (DESIGN.md → Layout).
 * Compact: < 640px · Medium: [640px, 1024px) · Expanded: ≥ 1024px.
 * Se expresan en CSS vía `sm:`/`lg:`. Ningún componente lee este mapa
 * todavía en C7.1 — se formaliza acá para que los builds siguientes no
 * inventen su propio corte.
 */
export const WINDOW_MODE_MIN_WIDTH: Record<WindowMode, number> = {
  compact: 0,
  medium: BREAKPOINTS.sm,
  expanded: BREAKPOINTS.lg,
};
