import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  onChangeBarbero: () => void;
}

export const HorarioStep = ({
  organizationId, sucursalId, servicioId, barberoId, fecha, excludeTurnoId,
  onSelect, onChangeFecha, onChangeBarbero,
}: Props) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      setError(null);
      setSelectedSlot(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("get-availability", {
          body: {
            organization_id: organizationId,
            sucursal_id: sucursalId,
            servicio_id: servicioId,
            fecha,
            barbero_id: barberoId,
            exclude_turno_id: excludeTurnoId || undefined,
          },
        });
        if (fnError || data?.error) {
          setError(data?.error || "Error al consultar disponibilidad");
          return;
        }
        setSlots(data.slots || []);
      } catch {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    };
    fetchSlots();
  }, [organizationId, sucursalId, servicioId, barberoId, fecha]);

  // Scroll into view when slots load
  useEffect(() => {
    if (!loading && slots.length > 0 && gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [loading, slots]);

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

  if (error) {
    return (
      <div className="text-center space-y-3 py-4">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-foreground font-medium">{error}</p>
      </div>
    );
  }

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
          <Button variant="outline" className="w-full gap-2 h-12" onClick={onChangeBarbero}>
            <UserRound className="h-4 w-4" /> Elegir otro barbero
          </Button>
          {barberoId && (
            <Button
              variant="outline"
              className="w-full gap-2 h-12"
              onClick={() => onSelect("", "", undefined, undefined)}
            >
              Probar con "Cualquiera disponible"
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" ref={gridRef}>
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
                "h-12 text-base font-medium transition-all",
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
