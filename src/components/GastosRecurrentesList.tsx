import { useState } from 'react';
import { Repeat, Trash2, Pause, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { RecordRow } from '@/components/ui/RecordRow';
import { MetricGroup } from '@/components/ui/MetricGroup';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GastoRecurrente } from '@/hooks/useGastosRecurrentes';
import { getRepeatLabel } from '@/components/tareas/RepeatPicker';
import { getCustomRepeatLabel } from '@/components/tareas/CustomRepeatSheet';
import { cn } from '@/lib/utils';

interface Props {
  recurrentes: GastoRecurrente[];
  readOnly?: boolean;
  onToggle: (id: string, activo: boolean) => void;
  onDelete: (id: string) => void;
}

export function GastosRecurrentesList({ recurrentes, onToggle, onDelete, readOnly = false }: Props) {
  const [deleteConfirm, setDeleteConfirm] = useState<GastoRecurrente | null>(null);

  if (recurrentes.length === 0) return null;

  const getLabel = (r: GastoRecurrente) => {
    if (r.repeat_preset === 'custom') {
      return getCustomRepeatLabel(r.repeat_frequency, r.repeat_interval, r.repeat_byweekday);
    }
    return getRepeatLabel(r.repeat_preset);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Gastos recurrentes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Registro (Tipo A): cada fila es una regla de recurrencia independiente con
            acciones propias (pausar/eliminar) — no una comparación de columnas
            (DESIGN.md → Registro vs. Tabla comparativa). */}
        {recurrentes.map((r) => (
          <div key={r.id} className={cn('rounded-lg border p-4', !r.activo && 'opacity-50')}>
            <RecordRow
              identity={
                <div className="min-w-0">
                  <p className="font-medium">{r.categoria}</p>
                  {r.descripcion && (
                    <p className="text-xs text-muted-foreground">{r.descripcion}</p>
                  )}
                </div>
              }
              actions={
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={readOnly}
                    onClick={() => onToggle(r.id, !r.activo)}
                    title={r.activo ? 'Pausar' : 'Activar'}
                  >
                    {r.activo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={readOnly}
                    aria-label="Eliminar gasto recurrente"
                    onClick={() => setDeleteConfirm(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              }
              metrics={
                <MetricGroup size="metric">
                  <div>
                    <p className="text-xs text-muted-foreground">Frecuencia</p>
                    <Badge variant="outline">{getLabel(r)}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monto</p>
                    <p className="font-medium tabular-nums whitespace-nowrap">
                      ${r.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Próxima fecha</p>
                    <p className="text-sm whitespace-nowrap">{r.proxima_fecha}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <StatusPill status={r.activo ? 'success' : 'neutral'} label={r.activo ? 'Activo' : 'Pausado'} />
                  </div>
                </MetricGroup>
              }
            />
          </div>
        ))}
      </CardContent>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar gasto recurrente</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm && (
                <>Vas a eliminar el gasto recurrente <strong>{deleteConfirm.categoria}</strong>. Esta acción no se puede deshacer.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) onDelete(deleteConfirm.id);
                setDeleteConfirm(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
