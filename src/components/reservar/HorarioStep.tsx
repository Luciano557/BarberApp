import { useState } from "react";
import { usePortalRead } from "./hooks/usePortalRead";
import { InlineReadError } from "@/components/ui/InlineReadError";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CalendarDays, UserRound, Check } from "lucide-react";
import { formatFechaLegible } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface Slot {
  hora_inicio: string;
  hora_fin: string;
  barberos: { id: string; nombre?: string }[];
}

interface Props {
  organizationId: string;
  sucursalId: string;
  servicioId: string;
  barberoId: string | null;
  fecha: string;
  excludeTurnoId?: string;
  onSelect: (horaInicio: string, horaFin: string, barberoId?: string, barberoNombre?: string) => void;
  onChangeFecha: () => void;
  onChangeBarbero?: () => void;
}

export const HorarioStep = ({
  organizationId, sucursalId, servicioId, barberoId, fecha, excludeTurnoId,
  onSelect, onChangeFecha, onChangeBarbero,
}: Props) => {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const { data, loading, error, refetch } = usePortalRead<{ slots: Slot[] }>(
    "get-availability", {
      organization_id: organizationId, sucursal_id: sucursalId, servicio_id: servicioId,
      barbero_id: barberoId, fecha, exclude_turno_id: excludeTurnoId,
    }, "No pudimos actualizar los horarios disponibles.",
  );
  const slots = data?.slots ?? [];

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Horarios disponibles</h2>
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) return <InlineReadError message="No pudimos cargar los horarios disponibles." onRetry={refetch} bordered={false} />;

  if (slots.length === 0) {
    return (
      <div className="space-y-4 py-4">
        <div className="text-center space-y-2">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">No hay turnos disponibles</h3>
          <p className="text-sm text-muted-foreground">
            No encontramos horarios para esta selección. Probá con alguna de estas opciones:
          </p>
        </div>
        <div className="space-y-2">
          <Button variant="outline" className="w-full gap-2 h-12" onClick={onChangeFecha}>
            <CalendarDays className="h-4 w-4" /> Probar otro día
          </Button>
          {onChangeBarbero && <Button variant="outline" className="w-full gap-2 h-12" onClick={onChangeBarbero}>
            <UserRound className="h-4 w-4" /> Elegir otro barbero
          </Button>}

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Elegí el horario</h2>
      <p className="text-sm text-muted-foreground">
        {slots.length} {slots.length === 1 ? "turno disponible" : "turnos disponibles"} para {formatFechaLegible(fecha)}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((slot) => {
          const isSelected = selectedSlot === slot.hora_inicio;
          return (
            <Button
              key={slot.hora_inicio}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "h-12 text-base font-medium transition-colors",
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
              onClick={() => {
                setSelectedSlot(slot.hora_inicio);
                const assignedBarbero = slot.barberos[0];
                onSelect(slot.hora_inicio, slot.hora_fin, assignedBarbero?.id, assignedBarbero?.nombre);
              }}
            >
              {isSelected && <Check className="h-4 w-4 mr-1" />}
              {slot.hora_inicio}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
