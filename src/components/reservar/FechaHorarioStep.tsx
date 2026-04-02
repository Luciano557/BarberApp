import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, UserRound, Check } from "lucide-react";
import { formatFechaLegible } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { es } from "date-fns/locale";

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
  onSelect: (horaInicio: string, horaFin: string, fecha: string, barberoId?: string, barberoNombre?: string) => void;
  onChangeBarbero: () => void;
}

export const FechaHorarioStep = ({
  organizationId, sucursalId, servicioId, barberoId,
  onSelect, onChangeBarbero,
}: Props) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const calendarDate = fecha ? new Date(fecha + "T12:00:00") : today;
  const isToday = fecha === formatToday();

  function formatToday() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

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

  useEffect(() => {
    if (!loading && slots.length > 0 && gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [loading, slots]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    setFecha(`${yyyy}-${mm}-${dd}`);
  };

  const renderSlots = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
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
            <h3 className="text-base font-semibold text-foreground">
              {isToday
                ? "No hay turnos disponibles para el día de hoy"
                : `No hay turnos disponibles para el ${formatFechaLegible(fecha)}`}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isToday
                ? "Probá seleccionando otro día en el calendario."
                : "Probá con otra fecha o cambiá de barbero."}
            </p>
          </div>
          <Button variant="outline" className="w-full gap-2 h-12" onClick={onChangeBarbero}>
            <UserRound className="h-4 w-4" /> Elegir otro barbero
          </Button>
        </div>
      );
    }

    return (
      <div ref={gridRef}>
        <p className="text-sm text-muted-foreground mb-2">
          {slots.length} {slots.length === 1 ? "turno disponible" : "turnos disponibles"}
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
                  onSelect(slot.hora_inicio, slot.hora_fin, fecha, assignedBarbero?.id, assignedBarbero?.nombre);
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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Elegí fecha y horario</h2>
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={calendarDate}
          onSelect={handleDateSelect}
          disabled={(date) => date < today}
          locale={es}
          className="rounded-md border pointer-events-auto"
        />
      </div>
      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={() => handleDateSelect(new Date())}>
          Hoy
        </Button>
      </div>
      {renderSlots()}
    </div>
  );
};
