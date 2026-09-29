import * as React from "react";

import { cn } from "@/lib/utils";
import { useScrollAffordance } from "@/hooks/use-scroll-affordance";

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * Opt-in exclusivo de Tabla comparativa (DESIGN.md → Components → "Registro
   * vs. Tabla comparativa"). Sin esta prop, `Table` es byte-idéntica a antes
   * de C7.5 — ningún consumidor existente (Sueldos, Gastos, Admin,
   * Estadísticas) cambia de comportamiento ni corre el hook nuevo. Con
   * `comparative`, agrega la afordancia de scroll horizontal de C7.4
   * (`useScrollAffordance`) sobre el wrapper `overflow-auto` que ya existía —
   * el consumidor sigue siendo responsable de su propio `min-width`.
   */
  comparative?: boolean;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, comparative = false, ...props }, forwardedRef) => {
    // Hook llamado siempre (regla de hooks) — su efecto no hace nada salvo
    // que `scrollRef` esté realmente adjunto a un nodo, así que para
    // `comparative=false` (el default, todas las tablas existentes) no crea
    // listener ni ResizeObserver: cero costo, cero cambio de comportamiento.
    const { ref: scrollRef, canScrollStart, canScrollEnd } = useScrollAffordance<HTMLDivElement>();

    if (!comparative) {
      return (
        <div className="relative w-full overflow-auto">
          <table ref={forwardedRef} className={cn("w-full caption-bottom text-sm", className)} {...props} />
        </div>
      );
    }

    // El fade es un hermano absolute del contenedor scrolleable, no un hijo
    // suyo — así no se mueve con el scroll horizontal, queda fijo en el
    // borde visible. Inerte salvo que la tabla realmente desborde.
    return (
      <div className="relative w-full">
        <div ref={scrollRef} className="w-full overflow-auto">
          <table ref={forwardedRef} className={cn("w-full caption-bottom text-sm", className)} {...props} />
        </div>
        {canScrollStart && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent"
          />
        )}
        {canScrollEnd && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent"
          />
        )}
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors duration-150 data-[state=selected]:bg-muted hover:bg-muted/50", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-xs uppercase tracking-wide text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle text-sm [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
