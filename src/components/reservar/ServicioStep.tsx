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
      <div className="portal-catalog">
        {servicios.map((s) => (
          <button key={s.id} type="button" onClick={() => onSelect(s.id, s.nombre, s.precio)} className="portal-choice">
            <span className="portal-choice__body">
              <span className="portal-choice__name">{s.nombre}</span>
              <span className="portal-choice__meta">{s.duracion_min} min</span>
              <span className="portal-choice__price">${s.precio.toLocaleString("es-AR")}</span>
            </span>
            <ChevronRight aria-hidden="true" className="portal-choice__arrow" />
          </button>
        ))}
      </div>
    </div>
  );
};
