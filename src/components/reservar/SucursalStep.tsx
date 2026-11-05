import { ChevronRight } from "lucide-react";

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
      <div className="portal-catalog">
        {sucursales.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id, s.nombre)}
            className="portal-choice"
          >

            <span className="min-w-0 flex-1 break-words text-base font-medium text-foreground">{s.nombre}</span>
            <ChevronRight aria-hidden="true" className="portal-choice__arrow" />
          </button>
        ))}
      </div>
    </div>
  );
};
