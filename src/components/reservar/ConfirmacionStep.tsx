import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BookingState } from "./BookingStepper";
import type { OrgPublicData } from "@/pages/Reservar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, Scissors, User, CalendarDays, Clock } from "lucide-react";

interface Props {
  booking: BookingState;
  orgData: OrgPublicData;
  onConfirmed: () => void;
  onSlotTaken: () => void;
}

export const ConfirmacionStep = ({ booking, orgData, onConfirmed, onSlotTaken }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      const { data, error: fnError } = await supabase.functions.invoke("validate-turno", {
        body: {
          organization_id: orgData.organization.id,
          sucursal_id: booking.sucursalId,
          barbero_id: booking.barberoId,
          servicio_id: booking.servicioId,
          fecha: booking.fecha,
          hora_inicio: booking.horaInicio,
          cliente_nombre: user?.user_metadata?.full_name || user?.email || "Cliente",
          cliente_telefono: user?.user_metadata?.phone || null,
          user_id: user?.id,
          cliente_email: user?.email || null,
        },
      });

      if (fnError || data?.error) {
        if (data?.error === "slot_taken") {
          toast.error(data.message || "Este horario ya fue reservado");
          onSlotTaken();
          return;
        }
        toast.error(data?.message || data?.error || "Error al confirmar el turno");
        return;
      }

      toast.success("¡Turno reservado con éxito!");
      onConfirmed();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Confirmá tu turno</h2>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-foreground">{booking.sucursalNombre}</span>
          </div>
          <div className="flex items-center gap-3">
            <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-foreground">{booking.servicioNombre} — ${booking.servicioPrecio.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-foreground">{booking.barberoNombre}</span>
          </div>
          <div className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-foreground">{booking.fecha}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-foreground">{booking.horaInicio} - {booking.horaFin}</span>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full text-lg h-12" onClick={handleConfirm} disabled={loading}>
        {loading ? "Confirmando..." : "Confirmar turno"}
      </Button>
    </div>
  );
};
