import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FechaStep } from "./FechaStep";
import { HorarioStep } from "./HorarioStep";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Check, CalendarDays, Clock, Scissors, User, MapPin } from "lucide-react";
import { toast } from "sonner";
import { formatFechaLegible } from "@/lib/dateUtils";

interface TurnoData {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  sucursal_id: string;
  sucursal_nombre: string;
  barbero_id: string;
  barbero_nombre: string;
  servicio_id: string;
  servicio_nombre: string;
  servicio_precio: number;
  organization_id: string;
}

interface Props {
  turno: TurnoData;
  telefono: string;
  onDone: () => void;
  onBack: () => void;
}

export const RescheduleFlow = ({ turno, telefono, onDone, onBack }: Props) => {
  const [step, setStep] = useState<"fecha" | "horario" | "confirming" | "done">("fecha");
  const [nuevaFecha, setNuevaFecha] = useState(turno.fecha);
  const [nuevaHoraInicio, setNuevaHoraInicio] = useState("");
  const [nuevaHoraFin, setNuevaHoraFin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reschedule-turno", {
        body: {
          turno_id: turno.id,
          nueva_fecha: nuevaFecha,
          nueva_hora_inicio: nuevaHoraInicio,
          telefono,
        },
      });

      if (error || data?.error) {
        if (data?.error === "slot_taken") {
          toast.error("Ese horario ya fue reservado. Elegí otro.");
          setStep("horario");
          return;
        }
        if (data?.error === "time_limit") {
          toast.error("Este turno ya no puede modificarse.");
          return;
        }
        toast.error(data?.message || data?.error || "Ocurrió un problema. Probá nuevamente.");
        return;
      }

      toast.success("¡Turno reprogramado!");
      setStep("done");
    } catch {
      toast.error("Ocurrió un problema. Probá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="text-center space-y-5 py-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">¡Turno reprogramado!</h2>
          <p className="text-muted-foreground">Tu nuevo horario</p>
        </div>

        <Card className="text-left">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{turno.sucursal_nombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{turno.servicio_nombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{turno.barbero_nombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{formatFechaLegible(nuevaFecha)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{nuevaHoraInicio} - {nuevaHoraFin}</span>
            </div>
          </CardContent>
        </Card>

        <Button onClick={onDone} className="w-full h-12">Volver a mis turnos</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={step === "fecha" ? onBack : () => setStep("fecha")} className="gap-1">
        <ChevronLeft className="h-4 w-4" /> Volver
      </Button>

      {/* Header contextual */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
        Reprogramando turno del <span className="font-medium text-foreground">{formatFechaLegible(turno.fecha)}</span> a las <span className="font-medium text-foreground">{turno.hora_inicio}</span>
      </div>

      {/* Context chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{turno.sucursal_nombre}</Badge>
        <Badge variant="secondary">{turno.servicio_nombre}</Badge>
        <Badge variant="secondary">{turno.barbero_nombre}</Badge>
        {step !== "fecha" && <Badge variant="secondary">{formatFechaLegible(nuevaFecha)}</Badge>}
      </div>

      {step === "fecha" && (
        <FechaStep
          value={nuevaFecha}
          onSelect={(fecha) => {
            setNuevaFecha(fecha);
            setStep("horario");
          }}
        />
      )}

      {step === "horario" && (
        <HorarioStep
          organizationId={turno.organization_id}
          sucursalId={turno.sucursal_id}
          servicioId={turno.servicio_id}
          barberoId={turno.barbero_id}
          fecha={nuevaFecha}
          excludeTurnoId={turno.id}
          onSelect={(horaInicio, horaFin) => {
            setNuevaHoraInicio(horaInicio);
            setNuevaHoraFin(horaFin);
            setStep("confirming");
          }}
          onChangeFecha={() => setStep("fecha")}
          onChangeBarbero={() => {}}
        />
      )}

      {step === "confirming" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Confirmar reprogramación</h2>

          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase">Nuevo horario</p>
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-muted-foreground" />
                <span>{turno.servicio_nombre}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{turno.barbero_nombre}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span>{formatFechaLegible(nuevaFecha)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{nuevaHoraInicio} - {nuevaHoraFin}</span>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full text-lg h-14 font-semibold" onClick={handleConfirm} disabled={loading}>
            {loading ? "Reprogramando..." : "Confirmar reprogramación"}
          </Button>
        </div>
      )}
    </div>
  );
};
