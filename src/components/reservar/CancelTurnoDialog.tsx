import { useRef, useState } from "react";
import { mutatePortalFunction, portalErrorCode } from "./lib/portalRequests";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { feedback } from "@/lib/feedback";
import { formatFechaLegible } from "@/lib/dateUtils";

interface Props {
  turno: { id: string; fecha: string; hora_inicio: string; servicio_nombre: string };
  telefono: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

export const CancelTurnoDialog = ({ turno, telefono, open, onOpenChange, onCancelled }: Props) => {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const handleCancel = async () => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError(null);
    try {
      await mutatePortalFunction("cancel-turno", { turno_id: turno.id, motivo: motivo || null, telefono });
      feedback.success("Turno cancelado correctamente");
      onCancelled();
    } catch (error) {
      setError(portalErrorCode(error) === "time_limit" ? "Este turno ya no puede cancelarse." : "No pudimos cancelar el turno. Intentá de nuevo.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={next => { if (!pending.current) onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Querés cancelar este turno?</AlertDialogTitle>
          <AlertDialogDescription>
            {turno.servicio_nombre} — {formatFechaLegible(turno.fecha)} a las {turno.hora_inicio}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <Textarea
            aria-label="Motivo de cancelación (opcional)"
            placeholder="Motivo de cancelación (opcional)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
          />
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Volver</AlertDialogCancel>
          <AlertDialogAction onClick={event => { event.preventDefault(); void handleCancel(); }} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {loading ? "Cancelando..." : "Sí, cancelar turno"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
