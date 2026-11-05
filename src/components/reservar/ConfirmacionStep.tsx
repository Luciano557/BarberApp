import { useRef, useState } from "react";
import { mutatePortalFunction, portalErrorCode } from "./lib/portalRequests";
import type { BookingState } from "./BookingStepper";
import type { OrgPublicData } from "@/pages/Reservar";
import { Button } from "@/components/ui/button";
import { feedback } from "@/lib/feedback";
import { MapPin, Scissors, User, CalendarDays, Clock } from "lucide-react";
import { formatFechaLegible } from "@/lib/dateUtils";
import { trackMetaEvent } from "@/lib/analytics/metaPixel";

interface Props {
  booking: BookingState;
  orgData: OrgPublicData;
  onConfirmed: () => void;
  onSlotTaken: () => void;
}

export const ConfirmacionStep = ({ booking, orgData, onConfirmed, onSlotTaken }: Props) => {
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);

  const handleConfirm = async () => {
    if (pending.current) return;
    if (!booking.cliente) {
      feedback.error("Faltan tus datos. Volvé al paso anterior.");
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      const { cliente } = booking;
      const nombreCompleto = [cliente.nombre, cliente.apellido].filter(Boolean).join(" ").trim();

      await mutatePortalFunction("validate-turno", {
          organization_id: orgData.organization.id,
          sucursal_id: booking.sucursalId,
          barbero_id: booking.barberoId,
          servicio_id: booking.servicioId,
          fecha: booking.fecha,
          hora_inicio: booking.horaInicio,
          cliente_nombre: cliente.nombre,
          cliente_apellido: cliente.apellido,
          cliente_telefono: cliente.telefono,
          cliente_email: cliente.email,
          cliente_fecha_nacimiento: cliente.birth_date,
          eligio_barbero: booking.eligioBarbero,
        });

      feedback.success(`¡Turno reservado, ${nombreCompleto || "listo"}!`);
      trackMetaEvent(orgData.portal?.meta_pixel_id, 'Schedule', {
        content_name: booking.servicioNombre,
        value: booking.servicioPrecio,
        currency: 'ARS',
      });
      onConfirmed();
    } catch (error) {
      const code = portalErrorCode(error);
      const slotErrors: Record<string, string> = {
        slot_taken: "Ese horario ya fue reservado. Elegí otro.",
        slot_too_soon: "Ese horario quedó muy cerca. Elegí otro.",
        outside_working_hours: "Ese horario ya no está disponible. Elegí otro.",
        slot_blocked: "Ese horario quedó bloqueado. Elegí otro.",
      };
      feedback.error(code && slotErrors[code] ? slotErrors[code] : "No pudimos confirmar el turno. Revisá tu conexión e intentá de nuevo.");
      if (code && slotErrors[code]) onSlotTaken();
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Confirmá tu turno</h2>
        <p className="text-sm text-muted-foreground">Revisá los datos antes de reservar.</p>
      </div>

      <div className="space-y-4 border-y border-border py-5">
        <div className="flex items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="min-w-0 break-words text-sm text-foreground">{booking.sucursalNombre}</span>
        </div>
        <div className="flex items-center gap-3">
          <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="min-w-0 break-words text-sm text-foreground">{booking.servicioNombre}</span>
        </div>
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="min-w-0 break-words text-sm text-foreground">{booking.barberoNombre}</span>
        </div>
        <div className="flex items-center gap-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground">{formatFechaLegible(booking.fecha)}</span>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground">{booking.horaInicio} - {booking.horaFin}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="max-w-full break-words text-2xl font-semibold tabular-nums text-foreground">${booking.servicioPrecio.toLocaleString("es-AR")}</span>
      </div>

      <Button className="w-full h-12 text-base font-semibold" onClick={handleConfirm} disabled={loading}>
        {loading ? "Confirmando..." : "Confirmar turno"}
      </Button>
    </div>
  );
};
