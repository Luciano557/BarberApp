import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Clock, MapPin, Scissors, User, RefreshCw, X, CalendarPlus } from "lucide-react";
import { CancelTurnoDialog } from "./CancelTurnoDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Turno {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  cliente_nombre: string;
  sucursal_id: string;
  sucursal_nombre: string;
  barbero_id: string;
  barbero_nombre: string;
  servicio_id: string;
  servicio_nombre: string;
  servicio_precio: number;
  servicio_duracion: number;
  organization_id: string;
  puede_cancelar: boolean;
  puede_reprogramar: boolean;
  cancelacion_limite_hs: number;
  modificacion_limite_hs: number;
}

interface Props {
  organizationId: string;
  onReschedule: (turno: Turno) => void;
  onBookNew: () => void;
}

export const MisTurnosStep = ({ organizationId, onReschedule, onBookNew }: Props) => {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTurno, setCancelTurno] = useState<Turno | null>(null);

  const fetchTurnos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-my-turnos", {
        body: { organization_id: organizationId },
      });
      if (!error && data?.turnos) {
        setTurnos(data.turnos);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTurnos();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (turnos.length === 0) {
    return (
      <div className="text-center space-y-4 py-8">
        <p className="text-muted-foreground">No tenés turnos próximos</p>
        <Button onClick={onBookNew} className="gap-2">
          <CalendarPlus className="h-4 w-4" />
          Reservar turno
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Mis turnos</h2>

        {turnos.map((turno) => (
          <Card key={turno.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant={turno.estado === "confirmado" ? "default" : "secondary"}>
                  {turno.estado === "confirmado" ? "Confirmado" : "Pendiente"}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{turno.sucursal_nombre}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{turno.servicio_nombre} — ${turno.servicio_precio?.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{turno.barbero_nombre}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{turno.fecha}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{turno.hora_inicio} - {turno.hora_fin}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1"
                        disabled={!turno.puede_reprogramar}
                        onClick={() => onReschedule(turno)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reprogramar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!turno.puede_reprogramar && (
                    <TooltipContent>
                      <p>Solo podés reprogramar con al menos {turno.modificacion_limite_hs}h de anticipación</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-1"
                        disabled={!turno.puede_cancelar}
                        onClick={() => setCancelTurno(turno)}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancelar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!turno.puede_cancelar && (
                    <TooltipContent>
                      <p>Solo podés cancelar con al menos {turno.cancelacion_limite_hs}h de anticipación</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </CardContent>
          </Card>
        ))}

        {cancelTurno && (
          <CancelTurnoDialog
            turno={cancelTurno}
            open={!!cancelTurno}
            onOpenChange={(open) => !open && setCancelTurno(null)}
            onCancelled={() => {
              setCancelTurno(null);
              fetchTurnos();
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
};
