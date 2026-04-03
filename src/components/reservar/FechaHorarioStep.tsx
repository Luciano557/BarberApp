import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, UserRound, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
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

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildDays(count: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(today, i);
    return {
      date: d,
      dateStr: toDateStr(d),
      dayNum: d.getDate(),
      dayName: format(d, "EEE", { locale: es }), // lun, mar, ...
    };
  });
}

export const FechaHorarioStep = ({
  organizationId, sucursalId, servicioId, barberoId,
  onSelect, onChangeBarbero,
}: Props) => {
  const days = useRef(buildDays(14)).current;
  const [fecha, setFecha] = useState(days[0].dateStr);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const ribbonRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);

  const selectedDay = days.find((d) => d.dateStr === fecha) ?? days[0];
  const monthLabel = format(selectedDay.date, "MMMM 'de' yyyy", { locale: es });

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
    if (!loading && slots.length > 0 && slotsRef.current) {
      slotsRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [loading, slots]);

  const renderSlots = () => {
    if (loading) {
      return (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
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
              No hay turnos disponibles para esta fecha
            </h3>
            <p className="text-sm text-muted-foreground">
              Probá con otro día o cambiá de barbero.
            </p>
          </div>
          <Button variant="outline" className="w-full gap-2 h-12" onClick={onChangeBarbero}>
            <UserRound className="h-4 w-4" /> Elegir otro barbero
          </Button>
        </div>
      );
    }

    return (
      <div ref={slotsRef} className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {slots.length} {slots.length === 1 ? "turno disponible" : "turnos disponibles"}
        </p>
        {slots.map((slot) => {
          const isSelected = selectedSlot === slot.hora_inicio;
          return (
            <Button
              key={slot.hora_inicio}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "w-full h-12 text-base font-medium justify-start transition-all",
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
              onClick={() => {
                setSelectedSlot(slot.hora_inicio);
                const b = slot.barberos[0];
                onSelect(slot.hora_inicio, slot.hora_fin, fecha, b?.id, b?.nombre);
              }}
            >
              {isSelected && <Check className="h-4 w-4 mr-2" />}
              {slot.hora_inicio}
            </Button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Elegí fecha y horario</h2>

      {/* Month label */}
      <p className="text-sm font-medium text-muted-foreground capitalize">{monthLabel}</p>

      {/* Date ribbon */}
      <div
        ref={ribbonRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1"
      >
        {days.map((d) => {
          const active = d.dateStr === fecha;
          return (
            <button
              key={d.dateStr}
              onClick={() => setFecha(d.dateStr)}
              className={cn(
                "flex flex-col items-center justify-center shrink-0 w-12 h-16 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-foreground hover:bg-accent"
              )}
            >
              <span className="text-base font-semibold leading-tight">{d.dayNum}</span>
              <span className="text-[11px] capitalize leading-tight mt-0.5">{d.dayName}</span>
            </button>
          );
        })}
      </div>

      {/* Time slots */}
      {renderSlots()}
    </div>
  );
};
