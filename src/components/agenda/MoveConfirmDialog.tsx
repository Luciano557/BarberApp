import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Barber } from '@/types/barbershop';
import { Turno } from './hooks/useAgendaData';
import { formatHHMM } from './lib/timeUtils';

interface MoveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turno: Turno | null;
  newBarberId: string;
  newHoraInicio: string;
  newHoraFin: string;
  newFecha: string;
  barbers: Barber[];
  onConfirm: () => void;
  loading: boolean;
}

export function MoveConfirmDialog({
  open, onOpenChange, turno, newBarberId, newHoraInicio, newHoraFin, newFecha, barbers, onConfirm, loading,
}: MoveConfirmDialogProps) {
  if (!turno) return null;
  const oldBarber = barbers.find(b => b.id === turno.barbero_id);
  const newBarber = barbers.find(b => b.id === newBarberId);
  const sameBarber = turno.barbero_id === newBarberId;
  const sameTime = turno.hora_inicio.slice(0, 5) === newHoraInicio.slice(0, 5) && turno.fecha === newFecha;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar cambio de turno</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-foreground font-medium">{turno.cliente_nombre || 'Sin nombre'}</div>
          {!sameTime && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-muted-foreground">Horario anterior</div>
                <div className="font-mono text-foreground">{turno.fecha} · {formatHHMM(turno.hora_inicio)}–{formatHHMM(turno.hora_fin)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Horario nuevo</div>
                <div className="font-mono text-primary">{newFecha} · {formatHHMM(newHoraInicio)}–{formatHHMM(newHoraFin)}</div>
              </div>
            </div>
          )}
          {!sameBarber && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-muted-foreground">Barbero anterior</div>
                <div className="text-foreground">{oldBarber ? `${oldBarber.firstName} ${oldBarber.lastName}` : '—'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Barbero nuevo</div>
                <div className="text-primary">{newBarber ? `${newBarber.firstName} ${newBarber.lastName}` : '—'}</div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={loading}>{loading ? 'Guardando…' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
