import { Card, CardContent } from "@/components/ui/card";
import { User, Users } from "lucide-react";

interface Props {
  barberos: { id: string; nombre: string; apellido: string }[];
  onSelect: (id: string | null, nombre: string) => void;
}

export const BarberoStep = ({ barberos, onSelect }: Props) => {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Elegí tu barbero</h2>

      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-primary/30"
        onClick={() => onSelect(null, "Cualquiera disponible")}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <Users className="h-5 w-5 text-primary shrink-0" />
          <span className="font-medium text-foreground">Cualquiera disponible</span>
        </CardContent>
      </Card>

      {barberos.map((b) => (
        <Card
          key={b.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelect(b.id, `${b.nombre} ${b.apellido}`)}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <User className="h-5 w-5 text-primary shrink-0" />
            <span className="font-medium text-foreground">{b.nombre} {b.apellido}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
