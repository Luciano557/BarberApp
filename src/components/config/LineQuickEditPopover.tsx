import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { DrawerForm } from '@/components/ui/drawer-form';
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

const lineQuickEditSchema = z.object({
  name: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(80, 'El nombre no puede superar los 80 caracteres.'),
  color: z.string(),
  active: z.boolean(),
});

type LineQuickEditValues = z.infer<typeof lineQuickEditSchema>;

export function LineQuickEditPopover({ line, onUpdate, onDelete, disabled }: LineQuickEditPopoverProps) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const form = useForm<LineQuickEditValues>({
    resolver: zodResolver(lineQuickEditSchema),
    defaultValues: { name: '', color: '', active: true },
  });

  const isDisabled = disabled || !line;

  // Inicializar al abrir con los valores actuales de la línea
  useEffect(() => {
    if (open && line) {
      form.reset({ name: line.name, color: line.color || '', active: line.active });
    }
  }, [open, line]);

  const onSubmit = async (values: LineQuickEditValues) => {
    if (!line) return;
    const trimmed = values.name.trim();

    const updates: Partial<Line> = {};
    if (trimmed !== line.name) updates.name = trimmed;
    const normalizedColor = values.color || undefined;
    if (normalizedColor !== (line.color || undefined)) updates.color = normalizedColor;
    if (values.active !== line.active) updates.active = values.active;

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
  const colorValue = form.watch('color');
  const activeValue = form.watch('active');

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={isDisabled}
                className="h-9 w-9"
                aria-label="Editar línea seleccionada"
                onClick={() => setOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isDisabled ? 'Selecciona una línea para editarla.' : 'Editar línea seleccionada'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DrawerForm
        open={open}
        onOpenChange={setOpen}
        title="Editar línea"
        size="sm"
        isDirty={form.formState.isDirty}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button type="button" variant="outline" size="sm" disabled={form.formState.isSubmitting} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={form.formState.isSubmitting} onClick={form.handleSubmit(onSubmit)}>
              {form.formState.isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={80} placeholder="Nombre de la línea" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">Color</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {LINE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => field.onChange(colorValue === c.value ? '' : c.value)}
                        className={`w-7 h-7 rounded-full border-2 transition-colors ${
                          colorValue === c.value ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                        aria-label={c.label}
                      />
                    ))}
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">Estado</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={activeValue ? 'default' : 'outline'}
                      onClick={() => field.onChange(true)}
                    >
                      Activa
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!activeValue ? 'default' : 'outline'}
                      onClick={() => field.onChange(false)}
                    >
                      Inactiva
                    </Button>
                  </div>
                </FormItem>
              )}
            />

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
          </div>
        </Form>
      </DrawerForm>

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
