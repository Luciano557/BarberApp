import { useState, useMemo } from "react";
import { usePortalRead } from "./hooks/usePortalRead";
import { InlineReadError } from "@/components/ui/InlineReadError";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { AlertCircle, UserRound, Check, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";

interface Slot {
  hora_inicio: string;
  hora_fin: string;
  barberos: { id: string; nombre?: string }[];
}

interface DayItem {
  date: Date;
  dateStr: string;
  dayNum: number;
  dayName: string;
}

interface Props {
  organizationId: string;
  sucursalId: string;
  servicioId: string;
  barberoId: string | null;
  initialFecha?: string;
  onSelect: (horaInicio: string, horaFin: string, fecha: string, barberoId?: string, barberoNombre?: string) => void;
  onChangeBarbero: () => void;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildDays(count: number): DayItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(today, i);
    return {
      date: d,
      dateStr: toDateStr(d),
      dayNum: d.getDate(),
      dayName: format(d, "EEE", { locale: es }),
    };
  });
}

export const FechaHorarioStep = ({
  organizationId, sucursalId, servicioId, barberoId, initialFecha,
  onSelect, onChangeBarbero,
}: Props) => {
  const allDays = useMemo(() => buildDays(30), []);
  const todayDate = allDays[0].date;
  const [showCalendar, setShowCalendar] = useState(false);
  const [requestedDate, setFecha] = useState<string | null>(initialFecha || null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const dates = usePortalRead<{ available_dates: string[]; max_date?: string }>(
    "get-available-dates", {
      organization_id: organizationId, sucursal_id: sucursalId, servicio_id: servicioId, barbero_id: barberoId,
      from_date: allDays[0].dateStr, to_date: allDays[allDays.length - 1].dateStr,
    }, "No pudimos actualizar las fechas disponibles.",
  );
  const loadingStrip = dates.loading;
  const availableSet = new Set(dates.data?.available_dates ?? []);
  const dayStatusMap = new Map(allDays.map(d => [d.dateStr, availableSet.has(d.dateStr)]));
  const fecha = requestedDate && (!dayStatusMap.has(requestedDate) || availableSet.has(requestedDate))
    ? requestedDate : dates.data?.available_dates[0] ?? null;
  const stripDays = allDays.filter(d => availableSet.has(d.dateStr)).slice(0, 5);
  if (fecha && dates.data && !stripDays.some(d => d.dateStr === fecha)) {
    const date = new Date(fecha + "T12:00:00");
    const extra = { date, dateStr: fecha, dayNum: date.getDate(), dayName: format(date, "EEE", { locale: es }) };
    if (stripDays.length === 5) stripDays.pop();
    stripDays.push(extra);
  }
  const maxDate = dates.data?.max_date ? new Date(dates.data.max_date + "T12:00:00") : null;
  const selectedDay = stripDays.find(d => d.dateStr === fecha);
  const monthLabel = selectedDay ? format(selectedDay.date, "MMMM 'de' yyyy", { locale: es }) : "";
  const availability = usePortalRead<{ slots: Slot[] }>(
    "get-availability", {
      organization_id: organizationId, sucursal_id: sucursalId, servicio_id: servicioId,
      barbero_id: barberoId, fecha,
    }, "No pudimos actualizar los horarios disponibles.", !!dates.data && !!fecha,
  );
  const slots = availability.data?.slots ?? [];
  const loading = availability.loading;
  const error = availability.error;

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    setShowCalendar(false);
    setFecha(toDateStr(date));
  };

  // ── Render slots ───────────────────────────────────────────────────────────
  const renderSlots = () => {
    if (!fecha) return null;

    if (loading) {
      return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,80px),1fr))] gap-2">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (error && !availability.data) {
      return (
        <InlineReadError message="No pudimos cargar los horarios disponibles." onRetry={availability.refetch} bordered={false} />
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
      <div className="portal-slots space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-medium text-foreground first-letter:uppercase">
            {format(new Date(fecha + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {slots.length} {slots.length === 1 ? "turno disponible" : "turnos disponibles"}
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,80px),1fr))] gap-2">
          {slots.map((slot) => {
            const isSelected = selectedSlot === slot.hora_inicio;
            return (
              <Button
                key={slot.hora_inicio}
                variant={isSelected ? "default" : "outline"}
                className={cn(
                  "h-12 min-w-0 px-2 text-base font-medium tabular-nums transition-colors",
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
      </div>
    );
  };

  if (dates.error && !dates.data) return <InlineReadError message="No pudimos cargar las fechas disponibles." onRetry={dates.refetch} bordered={false} />;

  // ── No available days at all ───────────────────────────────────────────────
  if (!loadingStrip && stripDays.length === 0) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-foreground">Elegí fecha y horario</h2>
        </div>
        <div className="space-y-4 py-4">
          <div className="text-center space-y-2">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="text-base font-semibold text-foreground">
              No hay turnos próximos disponibles
            </h3>
            <p className="text-sm text-muted-foreground">
              Intentá con otro barbero o volvé más tarde.
            </p>
          </div>
          <Button variant="outline" className="w-full gap-2 h-12" onClick={onChangeBarbero}>
            <UserRound className="h-4 w-4" /> Elegir otro barbero
          </Button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg font-medium text-foreground">Elegí fecha y horario</h2>
          {monthLabel && (
            <p className="text-sm text-muted-foreground first-letter:uppercase">{monthLabel}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-10 shrink-0 gap-1.5 px-3"
          aria-label="Ver más fechas"
          aria-expanded={showCalendar}
          aria-controls="booking-calendar"
          onClick={() => setShowCalendar((v) => !v)}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          Ver más
        </Button>
      </div>

      {/* Short ribbon — max 5 days. Ancho fluido (flex-1, sin shrink-0/w-12 fijo):
          5 botones de ancho fijo + gap podían superar el contenedor real en
          mobile angosto (sin overflow-x-auto ni wrap, eso se propagaba como
          scroll horizontal de página) — mismo día, misma cantidad, solo dejan
          de pedir más ancho del que hay. */}
      <div className="portal-dates flex gap-2">
        {loadingStrip
          ? [...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 flex-1 min-w-0 rounded-lg" />
            ))
          : stripDays.map((d) => {
              const active = d.dateStr === fecha;
              return (
                <button
                  key={d.dateStr}
                  type="button"
                  aria-pressed={active}
                  aria-label={format(d.date, "EEEE d 'de' MMMM", { locale: es })}
                  onClick={() => setFecha(d.dateStr)}
                  className={cn(
                    "portal-date flex h-16 flex-1 min-w-0 flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-foreground hover:bg-accent"
                  )}
                >
                  <span className="text-base font-semibold leading-tight">{d.dayNum}</span>
                  <span className="mt-1 text-xs capitalize leading-tight">{d.dayName}</span>
                </button>
              );
            })}
      </div>

      {/* Calendar inline */}
      {showCalendar && (
        <div id="booking-calendar" className="rounded-lg border border-border bg-card">
          <Calendar
            mode="single"
            selected={fecha ? new Date(fecha + "T12:00:00") : undefined}
            onSelect={handleCalendarSelect}
            disabled={(date) =>
              date < todayDate ||
              (maxDate ? date > maxDate : false) ||
              dayStatusMap.get(toDateStr(date)) === false
            }
            locale={es}
            className="w-full p-2"
            classNames={{
              months: "flex w-full flex-col",
              month: "w-full space-y-4",
              caption: "relative flex min-h-10 items-center justify-center px-12",
              nav_button: cn(buttonVariants({ variant: "outline" }), "h-10 w-10 bg-transparent p-0"),
              head_cell: "min-w-0 flex-1 text-xs font-normal text-muted-foreground",
              cell: "relative min-w-0 flex-1 p-0 text-center text-sm focus-within:z-20",
              day: cn(buttonVariants({ variant: "ghost" }), "h-10 w-full min-w-0 p-0 font-normal aria-selected:opacity-100"),
            }}
          />
        </div>
      )}

      {/* Time slots */}
      {renderSlots()}
    </div>
  );
};
