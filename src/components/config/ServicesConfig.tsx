import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, MoreVertical, Clock, Scissors } from 'lucide-react';
import { useShowMore } from '@/hooks/useShowMore';
import { ShowMoreDivider } from '@/components/ui/ShowMoreDivider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Service, Line } from '@/types/barbershop';
import { toast } from 'sonner';
import { LineQuickEditPopover } from './LineQuickEditPopover';
import { DrawerForm } from '@/components/ui/drawer-form';
import { TagPill } from '@/components/ui/TagPill';
import { EntityColorBar } from '@/components/ui/EntityColorBar';
import { CatalogSectionCard } from '@/components/ui/CatalogSectionCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

interface ServicesConfigProps {
  services: Service[];
  lines: Line[];
  onAdd: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdate: (id: string, updates: Partial<Service>) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
  /** Si se provee, habilita edición rápida de la línea seleccionada. */
  onUpdateLine?: (id: string, updates: Partial<Line>) => void | Promise<void>;
  /** Si se provee, habilita eliminación de líneas inactivas desde el popover. */
  onDeleteLine?: (id: string) => void | Promise<void>;
  /** Opcional: si se provee, habilita botón "Eliminar" para servicios inactivos. */
  onDelete?: (id: string) => void;
  /**
   * 'global' = edita catálogo global (sin precio); usa globalActive para Activos/Inactivos.
   * 'sucursal' (default) = comportamiento histórico por sucursal.
   */
  mode?: 'global' | 'sucursal';
  /** Permite crear nuevos servicios. Default true. */
  canCreate?: boolean;
  /** Permite editar nombre, duración y línea. Si es false, solo precio y activo se pueden modificar. Default true. */
  canEditStructure?: boolean;
}

interface ToggleConfirm {
  service: Service;
  action: 'activate' | 'deactivate';
}

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

const serviceSchema = (isGlobal: boolean) => z.object({
  name: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(80, 'El nombre no puede superar los 80 caracteres.'),
  price: isGlobal
    ? z.string().optional()
    : z.string().refine((v) => {
        const cleaned = (v || '').trim();
        if (!cleaned) return false;
        const n = parseFloat(cleaned);
        return !Number.isNaN(n) && n >= 0;
      }, 'El precio debe ser un número igual o mayor a 0.'),
  duration: z.string().refine((v) => {
    const n = parseInt(v, 10);
    return !Number.isNaN(n) && n >= 5;
  }, 'La duración debe ser de al menos 5 minutos.'),
  lineId: z.string(),
  descripcion: z.string().max(240, 'La descripción no puede superar los 240 caracteres.').optional(),
});

type ServiceFormValues = z.infer<ReturnType<typeof serviceSchema>>;

const emptyServiceValues: ServiceFormValues = { name: '', price: '', duration: '30', lineId: 'none', descripcion: '' };

const quickLineSchema = z.object({
  name: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(80, 'El nombre no puede superar los 80 caracteres.'),
  color: z.string().optional(),
});

type QuickLineFormValues = z.infer<typeof quickLineSchema>;

export function ServicesConfig({ services, lines, onAdd, onUpdate, onAddLine, onUpdateLine, onDeleteLine, onDelete, mode = 'sucursal', canCreate = true, canEditStructure = true }: ServicesConfigProps) {
  const isGlobal = mode === 'global';
  const structureLocked = !canEditStructure;
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [showAddLineDialog, setShowAddLineDialog] = useState(false);
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Service | null>(null);

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema(isGlobal)),
    defaultValues: emptyServiceValues,
  });

  const quickLineForm = useForm<QuickLineFormValues>({
    resolver: zodResolver(quickLineSchema),
    defaultValues: { name: '', color: '' },
  });

  const flagFor = (s: Service) => isGlobal ? (s.globalActive ?? s.active) : s.active;
  const activeLines = lines.filter(l => l.active);
  const activeServices = services.filter(s => flagFor(s)).sort((a, b) => {
    const lineA = activeLines.find(l => l.id === a.lineId)?.name ?? null;
    const lineB = activeLines.find(l => l.id === b.lineId)?.name ?? null;
    if (lineA === null && lineB !== null) return 1;
    if (lineA !== null && lineB === null) return -1;
    if (lineA !== null && lineB !== null) {
      const cmp = lineA.localeCompare(lineB, 'es');
      if (cmp !== 0) return cmp;
    }
    if (!isGlobal) return (b.price ?? 0) - (a.price ?? 0);
    return a.name.localeCompare(b.name, 'es');
  });
  const inactiveServices = services.filter(s => !flagFor(s));
  const editingService = editingId ? (services.find(s => s.id === editingId) ?? null) : null;
  const editingIsActive = editingService ? flagFor(editingService) : false;

  const { visible, expanded, toggle, showDivider, hiddenCount, threshold } =
    useShowMore(activeServices, { isDefaultView: activeSubTab === 'active' });

  const startAdd = () => {
    form.reset(emptyServiceValues);
    setIsAdding(true);
  };

  const closeDrawer = () => {
    setIsAdding(false);
    setEditingId(null);
    form.reset(emptyServiceValues);
  };

  const onSubmit = async (values: ServiceFormValues) => {
    const lineId = values.lineId && values.lineId !== 'none' ? values.lineId : undefined;
    const lineName = activeLines.find(l => l.id === lineId)?.name;
    const duration = parseInt(values.duration, 10);

    if (isAdding) {
      const price = isGlobal ? 0 : parseFloat(values.price!);
      await onAdd({
        name: values.name.trim(),
        price,
        durationMin: duration,
        active: true,
        lineId,
        lineName,
        descripcion: values.descripcion?.trim() || undefined,
      });
    } else if (editingService) {
      const updates: Partial<Service> = {};
      if (!structureLocked) {
        updates.name = values.name.trim();
        updates.durationMin = duration;
        updates.lineId = lineId;
        updates.lineName = lineName;
        updates.descripcion = values.descripcion?.trim() || undefined;
      }
      if (!isGlobal) {
        updates.price = parseFloat(values.price!);
      }
      await onUpdate(editingService.id, updates);
    }
    closeDrawer();
  };

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    form.reset({
      name: service.name,
      price: service.price ? String(service.price) : '',
      duration: (service.durationMin || 30).toString(),
      lineId: service.lineId || 'none',
      descripcion: service.descripcion ?? '',
    });
  };

  const closeAddLineDialog = () => {
    setShowAddLineDialog(false);
    quickLineForm.reset({ name: '', color: '' });
  };

  const onSubmitQuickLine = async (values: QuickLineFormValues) => {
    const newLine = await onAddLine({ name: values.name.trim(), active: true, color: values.color || undefined });
    if (newLine) {
      form.setValue('lineId', newLine.id);
    }
    closeAddLineDialog();
  };

  const handleConfirmToggle = () => {
    if (!toggleConfirm) return;
    onUpdate(toggleConfirm.service.id, { active: toggleConfirm.action === 'activate' });
    setToggleConfirm(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm || !onDelete) return;
    onDelete(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const isItemActive = (service: Service) =>
    isGlobal ? (service.globalActive ?? service.active) : service.active;

  const currentLineId = form.watch('lineId');

  const renderServiceItem = (service: Service) => {
    const itemActive = isItemActive(service);
    const linkedLine = lines.find(l => l.id === service.lineId && l.active);
    return (
    <div key={service.id} className="rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <EntityColorBar color={linkedLine?.color} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="min-w-0 break-words font-medium text-foreground sm:truncate">{service.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:justify-end">
          {linkedLine && (
            <TagPill label={linkedLine.name} />
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{service.durationMin || 30} min
          </span>
          {!isGlobal && (
            <span className="text-muted-foreground tabular-nums">${service.price.toLocaleString('es-AR')}</span>
          )}
        </div>
        <div className="flex items-center justify-end">
          <button
            onClick={() => startEdit(service)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent hover:bg-muted transition-colors border-[0.5px] border-border"
            title="Opciones"
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
    );
  };

  return (
    <>
      <CatalogSectionCard
        icon={Scissors}
        title={isGlobal ? 'Catálogo de servicios' : 'Servicios de esta sucursal'}
        description={isGlobal
          ? 'Nombre, duración y categoría. Los precios se configuran en cada sucursal.'
          : 'Activá los servicios disponibles y configurá el precio.'}
        actions={
          !isAdding && !editingId && activeSubTab === 'active' && canCreate ? (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={startAdd}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          ) : undefined
        }
        tabs={
          <SegmentedControl
            options={[
              { value: 'active', label: 'Activos', count: activeServices.length },
              { value: 'inactive', label: 'Inactivos', count: inactiveServices.length },
            ]}
            value={activeSubTab}
            onChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}
          />
        }
      >
        {activeSubTab === 'active' && (
          <div className="space-y-2" role="tabpanel">
            {visible.map((s, idx) => {
              const item = renderServiceItem(s);
              if (expanded && idx >= threshold) {
                return <div key={`sm-${s.id}`} className="animate-item-in">{item}</div>;
              }
              return item;
            })}
            {showDivider && (
              <ShowMoreDivider
                count={hiddenCount}
                onClick={toggle}
                expanded={expanded}
                label="servicios más"
              />
            )}
            {activeServices.length === 0 && !isAdding && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
                <Scissors className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">No hay servicios activos</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Agregá el primer servicio para que aparezca en el cobro.
                  </p>
                </div>
                {canCreate && (
                  <Button variant="outline" size="sm" onClick={startAdd}>
                    Agregar servicio
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        {activeSubTab === 'inactive' && (
          <div className="space-y-2" role="tabpanel">
            {inactiveServices.map(renderServiceItem)}
            {inactiveServices.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay servicios inactivos</p>
            )}
          </div>
        )}
      </CatalogSectionCard>

      <DrawerForm
        open={isAdding || editingId !== null}
        onOpenChange={(o) => { if (!o) closeDrawer(); }}
        title={isAdding ? 'Agregar servicio' : 'Editar servicio'}
        size="sm"
        isDirty={form.formState.isDirty}
        footer={
          isAdding ? (
            <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={closeDrawer} disabled={form.formState.isSubmitting}>Cancelar</Button>
              <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          ) : editingService ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <div className="w-px h-5 bg-border" />
              {editingIsActive ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setToggleConfirm({ service: editingService, action: 'deactivate' });
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
                      onUpdate(editingService.id, { active: true });
                      toast.success('Servicio activado');
                      closeDrawer();
                    }}
                    className="bg-status-success-bg text-status-success-foreground hover:bg-status-success/15"
                  >
                    Activar
                  </Button>
                  {onDelete && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setDeleteConfirm(editingService);
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
                    <Input {...field} maxLength={80} placeholder="Ej: Corte clásico" disabled={!isAdding && structureLocked} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isGlobal && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value ?? ''} onChange={field.onChange} placeholder="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duración</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input type="number" inputMode="numeric" min={5} {...field} disabled={!isAdding && structureLocked} />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">min</span>
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
                      disabled={!isAdding && structureLocked}
                      placeholder="Ej: Corte con detalles de terminación, shaver y experiencia completa."
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground text-right">{(field.value ?? '').length}/240</p>
                  <p className="text-xs text-muted-foreground">Este texto se mostrará en tu portal de reservas.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lineId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Línea</FormLabel>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select value={field.value} onValueChange={field.onChange} disabled={!isAdding && structureLocked}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Sin línea" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin línea</SelectItem>
                        {activeLines.map(line => (<SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    {onUpdateLine && (isAdding || !structureLocked) && (
                      <LineQuickEditPopover
                        line={lines.find(l => l.id === currentLineId) || null}
                        onUpdate={onUpdateLine}
                        onDelete={onDeleteLine}
                        disabled={!currentLineId || currentLineId === 'none' || !lines.find(l => l.id === currentLineId)}
                      />
                    )}
                    {(isAdding || !structureLocked) && (
                      <Button size="icon" variant="ghost" onClick={() => setShowAddLineDialog(true)} title="Nueva línea"><Plus className="h-4 w-4" /></Button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Form>
      </DrawerForm>

      {/* Toggle confirmation dialog */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => !open && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar servicio' : 'Activar servicio'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.action === 'deactivate'
                ? `¿Estás seguro de que querés desactivar "${toggleConfirm?.service.name}"?`
                : `¿Querés volver a activar "${toggleConfirm?.service.name}"?`}
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar servicio</AlertDialogTitle>
            <AlertDialogDescription>
              Este elemento dejará de aparecer en el sistema. No se modificarán los registros históricos donde ya haya sido utilizado. Esta acción no se podrá deshacer desde la interfaz.
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

      <DrawerForm
        open={showAddLineDialog}
        onOpenChange={(o) => { if (!o) closeAddLineDialog(); }}
        title="Nueva línea"
        size="sm"
        isDirty={quickLineForm.formState.isDirty}
        footer={
          <div className="flex w-full justify-between">
            <Button variant="ghost" onClick={closeAddLineDialog} disabled={quickLineForm.formState.isSubmitting}>Cancelar</Button>
            <Button onClick={quickLineForm.handleSubmit(onSubmitQuickLine)} disabled={quickLineForm.formState.isSubmitting}>
              {quickLineForm.formState.isSubmitting ? 'Guardando...' : 'Agregar'}
            </Button>
          </div>
        }
      >
        <Form {...quickLineForm}>
          <div className="space-y-4">
            <FormField
              control={quickLineForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Nombre de la línea (ej: Essencial, Deluxe)"
                      maxLength={80}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quickLineForm.handleSubmit(onSubmitQuickLine)(); } }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={quickLineForm.control}
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
          </div>
        </Form>
      </DrawerForm>
    </>
  );
}
