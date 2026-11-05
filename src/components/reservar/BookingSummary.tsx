import { Fragment } from "react";

import type { BookingState } from "./BookingStepper";
import { formatFechaLegible } from "@/lib/dateUtils";

interface Props {
  booking: BookingState;
  stepLabel?: string;
  variant?: "chip" | "full";
  className?: string;
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="portal-ticket__row"><dt>{label}</dt><dd className={value ? undefined : "portal-ticket__placeholder"}>{value || "Por elegir"}</dd></div>
);

const FullSummary = ({ booking, stepLabel }: { booking: BookingState; stepLabel?: string }) => (
  <aside className="portal-ticket" aria-label="Resumen de tu reserva">
    <div className="portal-ticket__header"><h2>Tu reserva</h2>{stepLabel && <span>{stepLabel}</span>}</div>
    <dl>
      <Row label="Sucursal" value={booking.sucursalNombre} />
      <Row label="Servicio" value={booking.servicioNombre} />
      <Row label="Barbero" value={booking.barberoNombre} />
      <Row label="Fecha" value={booking.fecha ? formatFechaLegible(booking.fecha) : ""} />
      <Row label="Hora" value={booking.horaInicio ? `${booking.horaInicio}${booking.horaFin ? ` – ${booking.horaFin}` : ""}` : ""} />
    </dl>
    {booking.servicioId && <div className="portal-ticket__total"><span>Total</span><strong>${booking.servicioPrecio.toLocaleString("es-AR")}</strong></div>}
  </aside>
);

const ChipSummary = ({ booking }: { booking: BookingState }) => {
  const parts: string[] = [];
  if (booking.sucursalNombre) parts.push(booking.sucursalNombre);
  if (booking.servicioNombre) parts.push(booking.servicioNombre);
  if (booking.barberoNombre) parts.push(booking.barberoNombre);
  if (booking.fecha) {
    parts.push(
      `${formatFechaLegible(booking.fecha)}${booking.horaInicio ? ` · ${booking.horaInicio}` : ""}`
    );
  }

  if (parts.length === 0) {
    return (
      <div className="flex items-center gap-2 border-b border-border pb-4 text-sm text-muted-foreground">
        Elegí una sucursal para empezar.
      </div>
    );
  }

  return (
    <p
      aria-label={`Tu reserva: ${parts.join(", ")}`}
      className="break-words border-b border-border pb-4 text-sm leading-relaxed"
    >
      {parts.map((value, i) => {
        const isLast = i === parts.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <span aria-hidden className="text-muted-foreground">
                {" › "}
              </span>
            )}
            <span className={isLast ? "font-medium text-foreground" : "text-muted-foreground"}>
              {value}
            </span>
          </Fragment>
        );
      })}
    </p>
  );
};

export const BookingSummary = ({ booking, stepLabel, variant = "full", className }: Props) => (
  <div className={className}>
    {variant === "chip" ? <ChipSummary booking={booking} /> : <FullSummary booking={booking} stepLabel={stepLabel} />}
  </div>
);
