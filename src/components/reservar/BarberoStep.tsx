import { Users, ChevronRight } from "lucide-react";

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
        className="portal-choice portal-choice--any"
      >
        <span className="portal-choice__avatar">
          <Users className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-base font-medium text-foreground">Cualquiera disponible</p>
          <p className="text-sm text-muted-foreground">Más opciones de horarios</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <div className="portal-catalog">
        {barberos.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect(b.id, `${b.nombre} ${b.apellido}`)}
            className="portal-choice"
          >
            <span className="portal-choice__avatar" aria-hidden="true">{b.nombre[0]}{b.apellido?.[0]}</span>
            <span className="min-w-0 flex-1 break-words text-base font-medium text-foreground">{b.nombre} {b.apellido}</span>
            <ChevronRight aria-hidden="true" className="portal-choice__arrow" />
          </button>
        ))}
      </div>
    </div>
  );
};
