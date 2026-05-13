import { MapPin, Scissors, User, CalendarDays, Clock, Sparkles } from "lucide-react";
import type { BookingState } from "./BookingStepper";
import { formatFechaLegible } from "@/lib/dateUtils";

interface Props {
  booking: BookingState;
  stepLabel?: string;
  className?: string;
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  accent?: boolean;
}

const Row = ({ icon, label, value, accent }: RowProps) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          value
            ? `truncate text-sm font-medium ${accent ? "text-primary" : "text-foreground"}`
            : "truncate text-sm text-muted-foreground/70"
        }
      >
        {value || "—"}
      </p>
    </div>
  </div>
);

export const BookingSummary = ({ booking, stepLabel, className }: Props) => {
  const hasAny =
    booking.sucursalNombre ||
    booking.servicioNombre ||
    booking.barberoNombre ||
    booking.fecha ||
    booking.horaInicio;

  return (
    <aside
      className={`rounded-2xl border border-border/60 bg-muted/40 p-5 ${className || ""}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Tu reserva</h3>
        {stepLabel && (
          <span className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {stepLabel}
          </span>
        )}
      </div>

      <div className="space-y-3.5">
        <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Sucursal" value={booking.sucursalNombre || null} />
        <Row icon={<Scissors className="h-3.5 w-3.5" />} label="Servicio" value={booking.servicioNombre || null} />
        <Row icon={<User className="h-3.5 w-3.5" />} label="Barbero" value={booking.barberoNombre || null} />
        <Row icon={<CalendarDays className="h-3.5 w-3.5" />} label="Fecha" value={booking.fecha ? formatFechaLegible(booking.fecha) : null} />
        <Row
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Hora"
          value={booking.horaInicio ? `${booking.horaInicio}${booking.horaFin ? ` – ${booking.horaFin}` : ""}` : null}
        />
        {booking.servicioPrecio > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Total</span>
            <span className="text-sm font-semibold text-primary">
              ${booking.servicioPrecio.toLocaleString("es-AR")}
            </span>
          </div>
        )}
      </div>

      {!hasAny && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Empezá eligiendo una sucursal.
        </p>
      )}
    </aside>
  );
};
