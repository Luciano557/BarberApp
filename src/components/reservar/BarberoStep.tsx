import { User, Users, ChevronRight } from "lucide-react";

interface Props {
  barberos: { id: string; nombre: string; apellido: string }[];
  onSelect: (id: string | null, nombre: string) => void;
}

export const BarberoStep = ({ barberos, onSelect }: Props) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Elegí tu barbero</h2>
        <p className="text-sm text-muted-foreground">Si no tenés preferencia, te asignamos uno disponible.</p>
      </div>

      <button
        type="button"
        onClick={() => onSelect(null, "Cualquiera disponible")}
        className="group flex w-full items-center gap-3 rounded-lg border border-input bg-muted/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-base font-medium text-foreground">Cualquiera disponible</p>
          <p className="text-sm text-muted-foreground">Más opciones de horarios</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <div className="space-y-2">
        {barberos.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect(b.id, `${b.nombre} ${b.apellido}`)}
            className="group flex w-full items-center gap-3 rounded-lg border border-input bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <User className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 break-words text-base font-medium text-foreground">{b.nombre} {b.apellido}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};
