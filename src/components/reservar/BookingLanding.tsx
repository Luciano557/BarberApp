import { Card, CardContent } from "@/components/ui/card";
import { CalendarPlus, Settings } from "lucide-react";

interface Props {
  onStart: () => void;
  onManage: () => void;
}

export const BookingLanding = ({ onStart, onManage }: Props) => {
  return (
    <div className="space-y-4">
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-primary/30"
        onClick={onStart}
      >
        <CardContent className="flex items-center gap-4 p-6">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <CalendarPlus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Reservar turno</h2>
            <p className="text-sm text-muted-foreground">Elegí tu servicio, barbero y horario</p>
          </div>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-muted-foreground/20"
        onClick={onManage}
      >
        <CardContent className="flex items-center gap-4 p-6">
          <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
            <Settings className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Reprogramar / Cancelar</h2>
            <p className="text-sm text-muted-foreground">Gestioná tus turnos existentes</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
