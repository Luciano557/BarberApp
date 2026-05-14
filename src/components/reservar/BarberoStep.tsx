import { User, Users, ChevronRight } from "lucide-react";

interface Props {
  barberos: { id: string; nombre: string; apellido: string }[];
  onSelect: (id: string | null, nombre: string) => void;
}

export const BarberoStep = ({ barberos, onSelect }: Props) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Elegí tu barbero</h2>
        <p className="text-xs text-muted-foreground">Si no tenés preferencia, te asignamos uno disponible.</p>
      </div>

      <button
        type="button"
        onClick={() => onSelect(null, "Cualquiera disponible")}
        className="group flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3.5 text-left transition-colors hover:bg-primary/[0.08]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Cualquiera disponible</p>
          <p className="text-xs text-muted-foreground">Más opciones de horarios</p>
        </div>
        <ChevronRight className="h-4 w-4 text-primary" />
      </button>

      <div className="space-y-2">
        {barberos.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect(b.id, `${b.nombre} ${b.apellido}`)}
            className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <User className="h-4 w-4" />
            </span>
            <span className="flex-1 break-words text-sm font-medium text-foreground">{b.nombre} {b.apellido}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
};
