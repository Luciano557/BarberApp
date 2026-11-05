import { Fragment, useLayoutEffect, useRef } from "react";
import { MapPin, Scissors, User, CalendarDays, Clock, Sparkles } from "lucide-react";
import type { BookingState } from "./BookingStepper";
import { formatFechaLegible } from "@/lib/dateUtils";

interface Props {
  booking: BookingState;
  stepLabel?: string;
  variant?: "chip" | "full";
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
    <div className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <p
        className={
          value
            ? `break-words text-sm font-medium ${accent ? "text-primary" : "text-foreground"}`
            : "break-words text-sm text-muted-foreground/70"
        }
      >
        {value || "—"}
      </p>
    </div>
  </div>
);

const FullSummary = ({ booking, stepLabel }: { booking: BookingState; stepLabel?: string }) => {
  const hasAny =
    booking.sucursalNombre ||
    booking.servicioNombre ||
    booking.barberoNombre ||
    booking.fecha ||
    booking.horaInicio;

  return (
    <aside className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-foreground">Tu reserva</h2>
        {stepLabel && (
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
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
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="max-w-full break-words text-lg font-semibold tabular-nums text-foreground">
              ${booking.servicioPrecio.toLocaleString("es-AR")}
            </span>
          </div>
        )}
      </div>

      {!hasAny && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Empezá eligiendo una sucursal.
        </p>
      )}
    </aside>
  );
};

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
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
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

export const BookingSummary = ({ booking, stepLabel, variant = "full", className }: Props) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastHeight = useRef<number | null>(null);
  const prevVariant = useRef(variant);

  // Anima la altura solo cuando cambia el modo (chip <-> full). Los cambios
  // incidentales de contenido (ej: aparece el total) no disparan animación, así
  // la instancia desktop —que nunca cambia de variant— queda idéntica a antes.
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const newHeight = el.offsetHeight;
    const variantChanged = prevVariant.current !== variant;
    const from = lastHeight.current;
    prevVariant.current = variant;
    lastHeight.current = newHeight;

    if (!variantChanged || from === null || from === newHeight) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    el.style.overflow = "hidden";
    el.style.height = `${from}px`;
    el.style.opacity = "0.35";
    void el.offsetHeight; // reflow para fijar el punto de partida
    el.style.transition = "height 220ms var(--ease-out-quint), opacity 200ms ease-out";
    el.style.height = `${newHeight}px`;
    el.style.opacity = "1";

    const cleanup = () => {
      el.style.height = "";
      el.style.transition = "";
      el.style.overflow = "";
      el.style.opacity = "";
      el.removeEventListener("transitionend", onEnd);
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === "height") cleanup();
    };
    el.addEventListener("transitionend", onEnd);
  });

  return (
    <div ref={wrapperRef} className={className}>
      {variant === "chip" ? (
        <ChipSummary booking={booking} />
      ) : (
        <FullSummary booking={booking} stepLabel={stepLabel} />
      )}
    </div>
  );
};
