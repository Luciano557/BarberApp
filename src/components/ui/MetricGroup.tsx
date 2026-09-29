import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricGroupProps {
  children: ReactNode;
  /** `metric` (96px, --metric-min) para filas densas; `kpi` (180px, --kpi-min) para cards con cifra destacada. */
  size?: "metric" | "kpi";
  className?: string;
}

/**
 * Contenedor de N métricas (etiqueta + valor) cuyo número de columnas surge
 * del espacio real, nunca `sm:`/`md:`/`lg:` ni JS — DESIGN.md → Layout,
 * "Métricas financieras". Implementación: flex-wrap con `flex-basis:
 * var(--metric-min|--kpi-min)`, no CSS Grid `auto-fit`. Probado con datos
 * reales (C7.5): `repeat(auto-fit, minmax(var(--kpi-min), 1fr))` deja que
 * `1fr` reparta el espacio en partes iguales sin mirar el contenido — una
 * cifra más ancha que su parte (ej. $1.234.567.890 en una fila de 3-4
 * columnas) queda más angosta que su propio texto y lo solapa con la columna
 * vecina. Flexbox con `min-width: auto` (el default de los flex item, sin
 * tocar) nunca deja que un ítem encoja por debajo del ancho de su propio
 * contenido — el wrap ocurre solo, sin ese riesgo.
 *
 * No impone la marca visual de cada métrica (color, ícono, énfasis) — eso lo
 * decide el consumidor, igual que `EmptyState`. La responsabilidad acá es
 * solo el layout: que la cifra completa nunca se corte y que la cantidad de
 * columnas reaccione al ancho real.
 */
export function MetricGroup({ children, size = "metric", className }: MetricGroupProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-3",
        size === "kpi"
          ? "[&>*]:grow [&>*]:shrink [&>*]:basis-[var(--kpi-min)]"
          : "[&>*]:grow [&>*]:shrink [&>*]:basis-[var(--metric-min)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
