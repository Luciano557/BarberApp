import { useState } from "react";
import { usePortalRead } from "./hooks/usePortalRead";
import { InlineReadError } from "@/components/ui/InlineReadError";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, MapPin, Scissors, User, RefreshCw, X, CalendarPlus } from "lucide-react";
import { CancelTurnoDialog } from "./CancelTurnoDialog";
import { formatFechaLegible } from "@/lib/dateUtils";
import { formatMinutesToText } from "@/lib/formatMinutes";


export interface Turno {
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
  cancelacion_limite_min: number;
  modificacion_limite_min: number;
}

interface Props {
  organizationId: string;
  telefono: string;
  onReschedule: (turno: Turno) => void;
  onBookNew: () => void;
}

export const MisTurnosStep = ({ organizationId, telefono, onReschedule, onBookNew }: Props) => {
  const { data, loading, error, refetch } = usePortalRead<{ turnos: Turno[] }>(
    "get-my-turnos-by-phone", { organization_id: organizationId, telefono }, "No pudimos actualizar tus turnos.",
  );
  const turnos = data?.turnos ?? [];
  const [cancelTurno, setCancelTurno] = useState<Turno | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error && !data) return <InlineReadError message="No pudimos cargar tus turnos." onRetry={refetch} bordered={false} />;

  if (turnos.length === 0) {
    return (
      <div className="text-center space-y-4 py-8">
        <p className="text-muted-foreground">No tenés turnos próximos. Reservá uno en segundos.</p>
        <Button onClick={onBookNew} className="gap-2 h-12">
          <CalendarPlus className="h-4 w-4" />
          Reservar turno
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-foreground">Mis turnos</h2>

      {turnos.map((turno) => (
        <Card key={turno.id} className="portal-record min-w-0 shadow-none">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="break-words text-base font-medium text-foreground">{formatFechaLegible(turno.fecha)}</h3>
              <Badge variant="secondary" className={turno.estado === "confirmado" ? "bg-status-success-bg text-status-success-foreground" : undefined}>
                {turno.estado === "confirmado" ? "Confirmado" : "Pendiente"}
              </Badge>
            </div>

            <p className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tabular-nums text-foreground">
              <span>{turno.hora_inicio}</span>
              <span className="text-base font-normal text-muted-foreground">– {turno.hora_fin}</span>
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="min-w-0 break-words font-medium text-foreground">{turno.servicio_nombre}</span>
              </div>
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="min-w-0 break-words text-foreground">{turno.barbero_nombre}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="min-w-0 break-words text-foreground">{turno.sucursal_nombre}</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{formatMinutesToText(turno.servicio_duracion)}</span>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="max-w-full break-words text-base font-semibold tabular-nums text-foreground">${turno.servicio_precio?.toLocaleString("es-AR")}</span>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,144px),1fr))] gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-12 w-full gap-2 px-3"
                disabled={!turno.puede_reprogramar}
                onClick={() => onReschedule(turno)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reprogramar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-12 w-full gap-2 px-3 text-destructive hover:bg-destructive/5 hover:text-destructive"
                disabled={!turno.puede_cancelar}
                onClick={() => setCancelTurno(turno)}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            </div>
            {!turno.puede_reprogramar && (
              <p className="text-sm text-muted-foreground">Solo podés reprogramar con al menos {formatMinutesToText(turno.modificacion_limite_min)} de anticipación.</p>
            )}
            {!turno.puede_cancelar && (
              <p className="text-sm text-muted-foreground">Solo podés cancelar con al menos {formatMinutesToText(turno.cancelacion_limite_min)} de anticipación.</p>
            )}
          </CardContent>
        </Card>
      ))}

      {cancelTurno && (
        <CancelTurnoDialog
          turno={cancelTurno}
          telefono={telefono}
          open={!!cancelTurno}
          onOpenChange={(open) => !open && setCancelTurno(null)}
          onCancelled={() => {
            setCancelTurno(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};
