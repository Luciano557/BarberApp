import { Scissors, ChevronRight } from "lucide-react";

interface Props {
  servicios: { id: string; nombre: string; precio: number; duracion_min: number }[];
  onSelect: (id: string, nombre: string, precio: number) => void;
}

export const ServicioStep = ({ servicios, onSelect }: Props) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Elegí el servicio</h2>
        <p className="text-xs text-muted-foreground">Vas a poder elegir un solo servicio por turno.</p>
      </div>
      <div className="space-y-2">
        {servicios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id, s.nombre, s.precio)}
            className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <Scissors className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium text-foreground">{s.nombre}</p>
              <p className="text-xs text-muted-foreground">{s.duracion_min} min</p>
            </div>
            <span className="text-sm font-semibold text-primary">${s.precio.toLocaleString("es-AR")}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
};
