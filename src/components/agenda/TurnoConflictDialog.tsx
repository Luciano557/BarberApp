import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { formatHHMM } from './lib/timeUtils';
import type { ConflictTurno } from './lib/updateTurnoInternal';

export type TurnoConflictKind = 'choque_de_horario' | 'fuera_de_horario';

interface TurnoConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: TurnoConflictKind | null;
  conflicts?: ConflictTurno[];
  onConfirm: () => void;
  loading?: boolean;
  descriptionOverride?: string;
  confirmLabel?: string;
}

export function TurnoConflictDialog({
  open,
  onOpenChange,
  kind,
  conflicts,
  onConfirm,
  loading,
  descriptionOverride,
  confirmLabel,
}: TurnoConflictDialogProps) {
  if (!kind) return null;

  const isChoque = kind === 'choque_de_horario';
  const title = isChoque ? 'Este horario ya está ocupado' : 'Fuera del horario habitual';
  const description = descriptionOverride ?? (isChoque
    ? 'Si continuás, este turno quedará superpuesto con otro turno del mismo profesional.'
    : 'El horario elegido queda fuera del horario habitual del profesional en esta sucursal.');
  const cta = confirmLabel ?? (isChoque ? 'Guardar igual (superponer)' : 'Guardar igual (fuera de horario)');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-status-warning-foreground" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isChoque && conflicts && conflicts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {conflicts.length === 1 ? 'Turno que se cruza:' : 'Turnos que se cruzan:'}
            </p>
            <ul className="space-y-1.5 border rounded-md p-3 bg-muted/30">
              {conflicts.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.cliente_nombre || 'Sin nombre'}</span>
                  <span className="font-mono text-xs text-muted-foreground shrink-0 ml-3">
                    {formatHHMM(c.hora_inicio)}–{formatHHMM(c.hora_fin)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? 'Guardando…' : cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
