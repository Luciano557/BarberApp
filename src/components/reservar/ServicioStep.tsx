import { Card, CardContent } from "@/components/ui/card";
import { Scissors } from "lucide-react";

interface Props {
  servicios: { id: string; nombre: string; precio: number; duracion_min: number }[];
  onSelect: (id: string, nombre: string, precio: number) => void;
}

export const ServicioStep = ({ servicios, onSelect }: Props) => {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Elegí el servicio</h2>
      {servicios.map((s) => (
        <Card
          key={s.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelect(s.id, s.nombre, s.precio)}
        >
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Scissors className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <span className="break-words font-medium text-foreground">{s.nombre}</span>
                <p className="text-xs text-muted-foreground">{s.duracion_min} min</p>
              </div>
            </div>
            <span className="self-end font-semibold text-primary sm:self-auto">${s.precio.toLocaleString()}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
