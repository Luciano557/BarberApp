import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RecordRowProps {
  /** Bloque de identidad (avatar, nombre, metadata). El consumidor debe darle `min-w-0` a su contenido. */
  identity: ReactNode;
  /** Acciones de la fila — siempre visibles, nunca detrás de hover. El consumidor las compone. */
  actions?: ReactNode;
  /** Típicamente un `<MetricGroup>`. */
  metrics?: ReactNode;
  className?: string;
}

/**
 * Presenta una entidad operativa independiente (Tipo A — Registro, DESIGN.md
 * → Components → "Registro vs. Tabla comparativa") mediante tres zonas:
 * identidad → métricas → acciones. No decide el contenido de cada zona — el
 * consumidor conserva su propia identidad visual (colores, íconos, badges);
 * esto solo formaliza el layout (flex/wrap/min-w-0) que ya usaban sus
 * consumidores reales.
 */
export function RecordRow({ identity, actions, metrics, className }: RecordRowProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">{identity}</div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {metrics && <div className="border-t border-border pt-4">{metrics}</div>}
    </div>
  );
}
