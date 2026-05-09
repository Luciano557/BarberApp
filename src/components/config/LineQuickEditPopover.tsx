import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Line } from '@/types/barbershop';
import { toast } from 'sonner';

const LINE_COLORS = [
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Verde', value: '#22C55E' },
  { label: 'Dorado', value: '#EAB308' },
  { label: 'Rojo', value: '#EF4444' },
  { label: 'Violeta', value: '#8B5CF6' },
  { label: 'Naranja', value: '#F97316' },
  { label: 'Rosa', value: '#EC4899' },
  { label: 'Gris', value: '#6B7280' },
];

interface LineQuickEditPopoverProps {
  line: Line | null;
  onUpdate: (id: string, updates: Partial<Line>) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  disabled?: boolean;
}

export function LineQuickEditPopover({ line, onUpdate, onDelete, disabled }: LineQuickEditPopoverProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>('');
  const [active, setActive] = useState<boolean>(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isDisabled = disabled || !line;

  // Inicializar al abrir el popover con los valores actuales de la línea
  useEffect(() => {
    if (open && line) {
      setName(line.name);
      setColor(line.color || '');
      setActive(line.active);
    }
  }, [open, line]);

  const handleSave = async () => {
    if (!line) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('El nombre no puede estar vacío.');
      return;
    }
    if (trimmed.length > 80) {
      toast.error('El nombre no puede superar los 80 caracteres.');
      return;
    }

    const updates: Partial<Line> = {};
    if (trimmed !== line.name) updates.name = trimmed;
    const normalizedColor = color || undefined;
    if (normalizedColor !== (line.color || undefined)) updates.color = normalizedColor;
    if (active !== line.active) updates.active = active;

    if (Object.keys(updates).length === 0) {
      setOpen(false);
      return;
    }

    try {
      await onUpdate(line.id, updates);
      setOpen(false);
    } catch {
      toast.error('No se pudo guardar la línea.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!line || !onDelete) return;
    try {
      await onDelete(line.id);
      setShowDeleteConfirm(false);
      setOpen(false);
    } catch {
      toast.error('No se pudo eliminar la línea.');
    }
  };

  // La eliminación solo se habilita si la línea YA está guardada como inactiva
  const canDelete = !!line && line.active === false;

  return (
    <>
      <Popover open={open} onOpenChange={(v) => !isDisabled && setOpen(v)}>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={isDisabled}
                    className="h-9 w-9"
                    aria-label="Editar línea seleccionada"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {isDisabled ? 'Selecciona una línea para editarla.' : 'Editar línea seleccionada'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <PopoverContent align="start" className="w-80 p-4">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Editar línea</h4>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Nombre de la línea"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Color</label>
              <div className="flex flex-wrap gap-2">
                {LINE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(color === c.value ? '' : c.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-colors ${
                      color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    aria-label={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  onClick={() => setActive(true)}
                >
                  Activa
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!active ? 'default' : 'outline'}
                  onClick={() => setActive(false)}
                >
                  Inactiva
                </Button>
              </div>
            </div>

            {onDelete && (
              <div className="pt-2 border-t border-border space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:text-destructive disabled:opacity-50"
                  disabled={!canDelete}
                  onClick={() => canDelete && setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar línea
                </Button>
                {!canDelete && (
                  <p className="text-xs text-muted-foreground">
                    Para eliminar esta línea, primero debes desactivarla.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleSave}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar línea</AlertDialogTitle>
            <AlertDialogDescription>
              Esta línea dejará de aparecer en el sistema. Los servicios asociados seguirán existiendo y aparecerán como Sin línea. Esta acción no se podrá deshacer desde la interfaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
