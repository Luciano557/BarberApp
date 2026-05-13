import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface Props {
  sucursales: { id: string; nombre: string }[];
  onSelect: (id: string, nombre: string) => void;
}

export const SucursalStep = ({ sucursales, onSelect }: Props) => {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Elegí la sucursal</h2>
      {sucursales.map((s) => (
        <Card
          key={s.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelect(s.id, s.nombre)}
        >
          <CardContent className="flex items-start gap-3 p-4">
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            <span className="break-words font-medium text-foreground">{s.nombre}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
