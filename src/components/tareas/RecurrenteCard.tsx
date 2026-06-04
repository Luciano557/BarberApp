import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, User, MapPin, CalendarDays, Repeat,
  Pause, Play, Pencil, Trash2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getRepeatLabel } from './RepeatPicker';
import { getCustomRepeatLabel } from './CustomRepeatSheet';
import { useRequirePinForAction } from '@/components/ActionPinGate';
import type { TareaRecurrente } from '@/hooks/useTareasRecurrentes';

interface Props {
  receta: TareaRecurrente;
  sucursalNombre?: string | null;
  canManage: boolean;
  canDelete: boolean;
  isSucursalAccount: boolean;
  onEdit: (r: TareaRecurrente) => void;
  onToggle: (r: TareaRecurrente) => void;
  onDelete: (r: TareaRecurrente) => void;
}

export function RecurrenteCard({
  receta,
  sucursalNombre,
  canManage,
  canDelete,
  isSucursalAccount,
  onEdit,
  onToggle,
  onDelete,
}: Props) {
  const requirePinForAction = useRequirePinForAction();
  const isTeam = receta.assignment_scope === 'team' || !receta.asignado_a;
  const repeatLabel =
    receta.repeat_preset === 'custom'
      ? getCustomRepeatLabel(receta.repeat_frequency, receta.repeat_interval, receta.repeat_byweekday)
      : getRepeatLabel(receta.repeat_preset);

  let proximaFormatted: string | null = null;
  try {
    proximaFormatted = format(parseISO(receta.proxima_fecha), 'dd MMM', { locale: es });
  } catch {
    proximaFormatted = receta.proxima_fecha;
  }

  const gated = async (run: () => void) => {
    if (isSucursalAccount) {
      const gate = await requirePinForAction('editar_tarea', receta.sucursal_id ?? null);
      if (gate.ok !== true) return;
    }
    run();
  };

  return (
    <Card className={`flex flex-col ${receta.activo ? '' : 'opacity-70'}`}>
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm leading-snug text-foreground line-clamp-2">{receta.titulo}</h3>
          {receta.activo ? (
            <Badge variant="outline" className="text-status-success-foreground border-status-success bg-status-success-bg gap-1">
              <Play className="w-3 h-3" />Activa
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Pause className="w-3 h-3" />Pausada
            </Badge>
          )}
        </div>

        {receta.descripcion && (
          <p className="text-xs text-muted-foreground line-clamp-2">{receta.descripcion}</p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground mt-auto">
          <span className="inline-flex items-center gap-1">
            {isTeam ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            {isTeam ? 'Todo el equipo' : (receta.asignado_nombre || 'Sin asignar')}
          </span>
          {sucursalNombre && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />{sucursalNombre}
            </span>
          )}
          {proximaFormatted && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="text-foreground/80">Próxima:</span> {proximaFormatted}
              {receta.hora && <span>· {receta.hora}</span>}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Repeat className="h-3.5 w-3.5" />{repeatLabel}
          </span>
        </div>

        {(canManage || canDelete) && (
          <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => gated(() => onToggle(receta))}>
                {receta.activo ? (
                  <><Pause className="h-4 w-4 mr-1" />Pausar</>
                ) : (
                  <><Play className="h-4 w-4 mr-1" />Activar</>
                )}
              </Button>
            )}
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => gated(() => onEdit(receta))}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => onDelete(receta)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
