import { MapPin, ChevronRight } from "lucide-react";

interface Props {
  sucursales: { id: string; nombre: string }[];
  onSelect: (id: string, nombre: string) => void;
}

export const SucursalStep = ({ sucursales, onSelect }: Props) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Elegí la sucursal</h2>
        <p className="text-sm text-muted-foreground">Seleccioná dónde querés atenderte.</p>
      </div>
      <div className="space-y-2">
        {sucursales.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id, s.nombre)}
            className="group flex w-full items-center gap-3 rounded-lg border border-input bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 break-words text-base font-medium text-foreground">{s.nombre}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};
