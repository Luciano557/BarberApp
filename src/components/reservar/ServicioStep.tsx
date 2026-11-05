import { ChevronRight } from "lucide-react";

interface Props {
  servicios: { id: string; nombre: string; precio: number; duracion_min: number }[];
  onSelect: (id: string, nombre: string, precio: number) => void;
}

export const ServicioStep = ({ servicios, onSelect }: Props) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Elegí el servicio</h2>
        <p className="text-sm text-muted-foreground">Vas a poder elegir un solo servicio por turno.</p>
      </div>
      <div className="space-y-2">
        {servicios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id, s.nombre, s.precio)}
            className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 rounded-lg border border-input bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 break-words text-base font-medium leading-snug text-foreground">{s.nombre}</span>
            <ChevronRight aria-hidden="true" className="mt-0.5 h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            <div className="col-span-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm text-muted-foreground">{s.duracion_min} min</span>
              <span className="max-w-full break-words text-base font-semibold tabular-nums text-foreground">${s.precio.toLocaleString("es-AR")}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
