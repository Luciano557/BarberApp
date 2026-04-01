import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { formatFechaLegible } from "@/lib/dateUtils";

interface Props {
  turno: { id: string; fecha: string; hora_inicio: string; servicio_nombre: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

export const CancelTurnoDialog = ({ turno, open, onOpenChange, onCancelled }: Props) => {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-turno", {
        body: { turno_id: turno.id, motivo: motivo || null },
      });

      if (error || data?.error) {
        if (data?.error === "time_limit") {
          toast.error("Este turno ya no puede cancelarse.");
          return;
        }
        toast.error(data?.message || data?.error || "Ocurrió un problema. Probá nuevamente.");
        return;
      }

      toast.success("Turno cancelado correctamente");
      onCancelled();
    } catch {
      toast.error("Ocurrió un problema. Probá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Querés cancelar este turno?</AlertDialogTitle>
          <AlertDialogDescription>
            {turno.servicio_nombre} — {formatFechaLegible(turno.fecha)} a las {turno.hora_inicio}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <Textarea
            placeholder="Motivo de cancelación (opcional)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Volver</AlertDialogCancel>
          <AlertDialogAction onClick={handleCancel} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {loading ? "Cancelando..." : "Sí, cancelar turno"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
