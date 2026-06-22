import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BookingState } from "./BookingStepper";
import type { OrgPublicData } from "@/pages/Reservar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MapPin, Scissors, User, CalendarDays, Clock } from "lucide-react";
import { formatFechaLegible } from "@/lib/dateUtils";

interface Props {
  booking: BookingState;
  orgData: OrgPublicData;
  onConfirmed: () => void;
  onSlotTaken: () => void;
}

export const ConfirmacionStep = ({ booking, orgData, onConfirmed, onSlotTaken }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!booking.cliente) {
      toast.error("Faltan tus datos. Volvé al paso anterior.");
      return;
    }
    setLoading(true);
    try {
      const { cliente } = booking;
      const nombreCompleto = [cliente.nombre, cliente.apellido].filter(Boolean).join(" ").trim();

      const { data, error: fnError } = await supabase.functions.invoke("validate-turno", {
        body: {
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
        },
      });

      if (fnError || data?.error) {
        const code = data?.error;
        if (code === "slot_taken") {
          toast.error("Ese horario ya fue reservado. Elegí otro.");
          onSlotTaken();
          return;
        }
        if (code === "slot_too_soon") {
          toast.error("Ese horario quedó muy cerca. Elegí otro.");
          onSlotTaken();
          return;
        }
        if (code === "outside_working_hours") {
          toast.error("Ese horario ya no está disponible. Elegí otro.");
          onSlotTaken();
          return;
        }
        if (code === "slot_blocked") {
          toast.error("Ese horario quedó bloqueado. Elegí otro.");
          onSlotTaken();
          return;
        }
        toast.error(data?.message || data?.error || "Ocurrió un problema. Probá nuevamente.");
        return;
      }

      toast.success(`¡Turno reservado, ${nombreCompleto || "listo"}!`);
      onConfirmed();
    } catch {
      toast.error("Ocurrió un problema. Probá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Confirmá tu turno</h2>
        <p className="text-xs text-muted-foreground">Revisá los datos antes de reservar.</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/40 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground">{booking.sucursalNombre}</span>
        </div>
        <div className="flex items-center gap-3">
          <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground">
            {booking.servicioNombre} — <span className="font-medium text-primary">${booking.servicioPrecio.toLocaleString("es-AR")}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground">{booking.barberoNombre}</span>
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

      <Button className="w-full h-12 text-base font-semibold" onClick={handleConfirm} disabled={loading}>
        {loading ? "Confirmando..." : "Confirmar turno"}
      </Button>
    </div>
  );
};
