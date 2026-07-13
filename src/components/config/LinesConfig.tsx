import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, MoreVertical, Tag, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Line } from '@/types/barbershop';
import { toast } from 'sonner';
import { DrawerForm } from '@/components/ui/drawer-form';
import { EntityColorBar } from '@/components/ui/EntityColorBar';
import { CatalogSectionCard } from '@/components/ui/CatalogSectionCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface LinesConfigProps {
  lines: Line[];
  onAdd: (line: Omit<Line, 'id'>) => Promise<Line | null>;
  onUpdate: (id: string, updates: Partial<Line>) => void;
  onDelete?: (id: string) => void;
  /** Si se provee, habilita reordenamiento DnD (puntero + teclado) en la tab "Activas". */
  onReorder?: (ids: string[]) => Promise<void>;
}

interface ToggleConfirm {
  line: Line;
  action: 'activate' | 'deactivate';
}

const lineSchema = z.object({
  name: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(80, 'El nombre no puede superar los 80 caracteres.'),
  color: z.string().optional(),
  descripcion: z.string().max(240, 'La descripción no puede superar los 240 caracteres.').optional(),
});

type LineFormValues = z.infer<typeof lineSchema>;

const emptyValues: LineFormValues = { name: '', color: '', descripcion: '' };

interface SortableLineItemProps {
  line: Line;
  onEdit: (line: Line) => void;
  isReorderable: boolean;
}

function SortableLineItem({ line, onEdit, isReorderable }: SortableLineItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: line.id, disabled: !isReorderable });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {isReorderable && (
          <button
            type="button"
            aria-label={`Reordenar ${line.name}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted touch-none cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-ring"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <EntityColorBar color={line.color} />
        <div className="flex flex-1 items-center gap-3">
          <span className="flex-1 font-medium text-foreground">{line.name}</span>
          <button
            onClick={() => onEdit(line)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent hover:bg-muted transition-colors border-[0.5px] border-border"
            title="Opciones"
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function LinesConfig({ lines, onAdd, onUpdate, onDelete, onReorder }: LinesConfigProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Line | null>(null);

  const form = useForm<LineFormValues>({
    resolver: zodResolver(lineSchema),
    defaultValues: emptyValues,
  });

  const active = useMemo(() => {
    return [...lines.filter(l => l.active)].sort((a, b) => {
      const oa = a.orden ?? Number.MAX_SAFE_INTEGER;
      const ob = b.orden ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name, 'es');
    });
  }, [lines]);
  const inactive = lines.filter(l => !l.active);
  const editingLine = editingId ? (lines.find(l => l.id === editingId) ?? null) : null;
  const editingIsActive = editingLine?.active ?? false;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const isReorderable = !!onReorder && active.length > 1;

  const startAdd = () => {
    form.reset(emptyValues);
    setIsAdding(true);
  };

  const closeDrawer = () => {
    setIsAdding(false);
    setEditingId(null);
    form.reset(emptyValues);
  };

  const onSubmit = async (values: LineFormValues) => {
    const payload = {
      name: values.name.trim(),
      color: values.color || undefined,
      descripcion: values.descripcion?.trim() || undefined,
    };
    if (isAdding) {
      await onAdd({ ...payload, active: true });
    } else if (editingLine) {
      await onUpdate(editingLine.id, payload);
    }
    closeDrawer();
  };

  const startEdit = (line: Line) => {
    setEditingId(line.id);
    form.reset({ name: line.name, color: line.color || '', descripcion: line.descripcion ?? '' });
  };

  const handleConfirmToggle = () => {
    if (!toggleConfirm) return;
    onUpdate(toggleConfirm.line.id, { active: toggleConfirm.action === 'activate' });
    setToggleConfirm(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm || !onDelete) return;
    onDelete(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active: act, over } = event;
    if (!over || act.id === over.id || !onReorder) return;
    const oldIndex = active.findIndex(l => l.id === act.id);
    const newIndex = active.findIndex(l => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(active, oldIndex, newIndex);
    await onReorder(newOrder.map(l => l.id));
  };

  const renderInactiveLine = (line: Line) => (
    <div key={line.id} className="animate-item-in">
      <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <EntityColorBar color={line.color} />
          <div className="flex flex-1 items-center gap-3">
            <span className="flex-1 font-medium text-foreground">{line.name}</span>
            <button
              onClick={() => startEdit(line)}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent hover:bg-muted transition-colors border-[0.5px] border-border"
              title="Opciones"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <CatalogSectionCard
        icon={Tag}
        title="Agrupación de servicios"
        description={isReorderable
          ? 'Organizan el menú de cobro y el orden con el que verá el cliente en tu portal de reservas. Arrastrá para reordenar.'
          : 'Organizan el menú de cobro y facilitan la búsqueda de servicios.'}
        actions={
          !isAdding && !editingId && activeSubTab === 'active' ? (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={startAdd}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          ) : undefined
        }
        tabs={
          <SegmentedControl
            options={[
              { value: 'active', label: 'Activas', count: active.length },
              { value: 'inactive', label: 'Inactivas', count: inactive.length },
            ]}
            value={activeSubTab}
            onChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}
          />
        }
      >
        {activeSubTab === 'active' && (
          <div className="space-y-2" role="tabpanel">
            {active.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={active.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {active.map(line => (
                      <div key={line.id} className="animate-item-in">
                        <SortableLineItem
                          line={line}
                          onEdit={startEdit}
                          isReorderable={isReorderable}
                        />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            {active.length === 0 && !isAdding && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
                <Tag className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">No hay categorías activas</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Las categorías agrupan tus servicios en la pantalla de cobro.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={startAdd}>
                  Agregar categoría
                </Button>
              </div>
            )}
          </div>
        )}
        {activeSubTab === 'inactive' && (
          <div className="space-y-2" role="tabpanel">
            {inactive.map(renderInactiveLine)}
            {inactive.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay líneas inactivas</p>
            )}
          </div>
        )}
      </CatalogSectionCard>

      <DrawerForm
        open={isAdding || editingId !== null}
        onOpenChange={(o) => { if (!o) closeDrawer(); }}
        title={isAdding ? 'Agregar categoría' : 'Editar categoría'}
        size="sm"
        isDirty={form.formState.isDirty}
        footer={
          isAdding ? (
            <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={closeDrawer} disabled={form.formState.isSubmitting}>Cancelar</Button>
              <Button disabled={form.formState.isSubmitting} onClick={form.handleSubmit(onSubmit)}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          ) : editingLine ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button disabled={form.formState.isSubmitting} onClick={form.handleSubmit(onSubmit)}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <div className="w-px h-5 bg-border" />
              {editingIsActive ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setToggleConfirm({ line: editingLine, action: 'deactivate' });
                    closeDrawer();
                  }}
                  className="bg-status-warning text-white hover:bg-status-warning/90"
                >
                  Desactivar
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      onUpdate(editingLine.id, { active: true });
                      toast.success('Línea activada');
                      closeDrawer();
                    }}
                    className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                  >
                    Activar
                  </Button>
                  {onDelete && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setDeleteConfirm(editingLine);
                        closeDrawer();
                      }}
                    >
                      Eliminar
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : null
        }
      >
        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ej: Essencial, Deluxe" maxLength={80} />
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
                  <FormLabel>Color (opcional)</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {LINE_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => field.onChange(field.value === c.value ? '' : c.value)}
                          className={`w-8 h-8 rounded-full border-2 transition-colors ${field.value === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      maxLength={240}
                      placeholder="Ej: Servicios premium con detalles de terminación."
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground text-right">{(field.value ?? '').length}/240</p>
                  <p className="text-xs text-muted-foreground">Este texto se mostrará en tu portal de reservas.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Form>
      </DrawerForm>

      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => !open && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar línea' : 'Activar línea'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.action === 'deactivate'
                ? `¿Estás seguro de que querés desactivar "${toggleConfirm?.line.name}"? Los servicios asociados seguirán existiendo, pero la línea no aparecerá como opción.`
                : `¿Querés volver a activar "${toggleConfirm?.line.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              className={toggleConfirm?.action === 'deactivate' ? 'bg-status-warning text-white hover:bg-status-warning/90' : undefined}
            >
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar línea</AlertDialogTitle>
            <AlertDialogDescription>
              Esta línea dejará de aparecer en el sistema. Los servicios que la usaban seguirán existiendo y quedarán sin línea. No se modificarán los registros históricos. Esta acción no se podrá deshacer desde la interfaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
