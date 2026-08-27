import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, MoreVertical, BadgePercent } from 'lucide-react';
import { useShowMore } from '@/hooks/useShowMore';
import { ShowMoreDivider } from '@/components/ui/ShowMoreDivider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TagPill } from '@/components/ui/TagPill';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Discount, DiscountAppliesTo } from '@/types/barbershop';
import { DrawerForm } from '@/components/ui/drawer-form';
import { CatalogSectionCard } from '@/components/ui/CatalogSectionCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

interface DiscountsConfigProps {
  discounts: Discount[];
  onAdd: (discount: Omit<Discount, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Discount>) => void;
  onDelete: (id: string) => void;
  onToggleActive?: (id: string, activo: boolean) => void;
  /**
   * 'global' = edita catálogo global; usa globalActive para Activos/Inactivos.
   * 'sucursal' (default) = comportamiento histórico.
   */
  mode?: 'global' | 'sucursal';
}

const ROUNDING_UNITS = [1, 10, 50, 100, 500, 1000];

type TypeFilter = 'todos' | DiscountAppliesTo;

const discountSchema = z
  .object({
    label: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(80, 'El nombre no puede superar los 80 caracteres.'),
    value: z.string(),
    type: z.enum(['percentage', 'fixed']),
    rounding: z.enum(['cliente', 'negocio', 'matematico']),
    roundingUnit: z.number(),
    paymentMethod: z.enum(['todos', 'efectivo', 'mercado_pago']),
    appliesTo: z.enum(['servicios', 'productos']),
  })
  .superRefine((data, ctx) => {
    const cleaned = (data.value || '').toString().trim();
    if (!cleaned) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: data.type === 'percentage'
          ? 'El porcentaje debe ser mayor a 0 y menor o igual a 100.'
          : 'El monto debe ser mayor a 0.',
      });
      return;
    }
    const value = parseFloat(cleaned);
    if (Number.isNaN(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Ingresá un valor numérico válido.' });
      return;
    }
    if (data.type === 'percentage') {
      if (value <= 0 || value > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'El porcentaje debe ser mayor a 0 y menor o igual a 100.' });
      }
    } else if (value <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'El monto debe ser mayor a 0.' });
    }
  });

type DiscountFormValues = z.infer<typeof discountSchema>;

export function DiscountsConfig({
  discounts,
  onAdd,
  onUpdate,
  onDelete,
  onToggleActive,
  mode = 'sucursal',
}: DiscountsConfigProps) {
  const isGlobal = mode === 'global';
  const [activeTab, setActiveTab] = useState<'activos' | 'inactivos'>('activos');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Discount | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState<Discount | null>(null);

  const defaultValues = (): DiscountFormValues => ({
    label: '',
    value: '',
    type: 'percentage',
    rounding: 'cliente',
    roundingUnit: 100,
    paymentMethod: 'todos',
    appliesTo: typeFilter === 'productos' ? 'productos' : 'servicios',
  });

  const form = useForm<DiscountFormValues>({
    resolver: zodResolver(discountSchema),
    defaultValues: defaultValues(),
  });

  const newType = form.watch('type');

  const startAdd = () => {
    form.reset(defaultValues());
    setIsAdding(true);
  };

  const closeDrawer = () => {
    setIsAdding(false);
    setEditingId(null);
    form.reset(defaultValues());
  };

  const onSubmit = async (values: DiscountFormValues) => {
    const payload = {
      label: values.label.trim(),
      value: parseFloat(values.value),
      type: values.type,
      rounding: values.rounding,
      roundingUnit: values.roundingUnit,
      paymentMethod: values.paymentMethod,
      appliesTo: values.appliesTo,
    };
    if (isAdding) {
      await onAdd({ ...payload, active: true });
    } else if (editingDiscount) {
      await onUpdate(editingDiscount.id, payload);
    }
    closeDrawer();
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    onDelete(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const handleConfirmDeactivate = () => {
    if (!deactivateConfirm || !onToggleActive) return;
    onToggleActive(deactivateConfirm.id, false);
    toast.success('Descuento desactivado');
    setDeactivateConfirm(null);
  };

  const startEdit = (d: Discount) => {
    setIsAdding(false);
    setEditingId(d.id);
    form.reset({
      label: d.label,
      value: d.value.toString(),
      type: d.type || 'percentage',
      rounding: d.rounding || 'cliente',
      roundingUnit: d.roundingUnit || 100,
      paymentMethod: d.paymentMethod || 'todos',
      appliesTo: d.appliesTo || 'servicios',
    });
  };

  const filtered = useMemo(() => {
    if (typeFilter === 'todos') return discounts;
    return discounts.filter(d => (d.appliesTo || 'servicios') === typeFilter);
  }, [discounts, typeFilter]);

  const flagFor = (d: Discount) => isGlobal ? (d.globalActive ?? d.active) : d.active;
  const activos = filtered.filter(d => flagFor(d));
  const inactivos = filtered.filter(d => !flagFor(d));
  const editingDiscount = editingId ? (discounts.find(d => d.id === editingId) ?? null) : null;

  const isDefaultView = activeTab === 'activos' && typeFilter === 'todos';
  const { visible, expanded, toggle, showDivider, hiddenCount } =
    useShowMore(activos, { isDefaultView });
  const editingIsActive = editingDiscount ? flagFor(editingDiscount) : false;
  const canToggle = !!onToggleActive && !(!isGlobal && editingDiscount?.globalActive === false);

  const FormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Promo Amigo" {...field} maxLength={80} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="appliesTo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aplica a</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="servicios">Servicios</SelectItem>
                  <SelectItem value="productos">Productos</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                  <SelectItem value="fixed">Monto Fijo ($)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{newType === 'percentage' ? 'Porcentaje' : 'Monto'}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={newType === 'percentage' ? '% (ej: 15)' : '$ (ej: 1000)'}
                  min="0"
                  max={newType === 'percentage' ? 100 : undefined}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {newType === 'percentage' && (
          <>
            <FormField
              control={form.control}
              name="rounding"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Redondeo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cliente">↓ Favor Cliente (redondea hacia abajo)</SelectItem>
                      <SelectItem value="negocio">↑ Favor Negocio (redondea hacia arriba)</SelectItem>
                      <SelectItem value="matematico">≈ Al más cercano (redondeo matemático)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roundingUnit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidad de Redondeo</FormLabel>
                  <Select value={field.value.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROUNDING_UNITS.map(unit => (
                        <SelectItem key={unit} value={unit.toString()}>
                          {unit === 1 ? 'Sin redondeo (exacto)' : `A ${unit}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        <FormField
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Aplica con método de pago</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="todos">Todos los métodos</SelectItem>
                  <SelectItem value="efectivo">Solo Efectivo</SelectItem>
                  <SelectItem value="mercado_pago">Solo QR</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );

  const renderRow = (d: Discount) => {
    const appliesTo = d.appliesTo || 'servicios';
    const categoryLabel = appliesTo === 'productos' ? 'Productos' : 'Servicios';
    const valueLabel = d.type === 'fixed'
      ? `$${d.value.toLocaleString('es-AR')}`
      : `${d.value}%`;
    return (
      <div key={d.id} className="animate-item-in">
        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted sm:flex-row sm:items-center">
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground">{d.label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <TagPill label={categoryLabel} />
            <Badge variant="category">{valueLabel}</Badge>
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={() => startEdit(d)}
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
        icon={BadgePercent}
        title={isGlobal ? 'Reglas de descuento' : 'Descuentos disponibles'}
        description={isGlobal
          ? 'Por porcentaje o monto fijo. Pueden aplicar a servicios, productos o ambos.'
          : 'Activá o desactivá los descuentos para esta sucursal.'}
        actions={
          !isAdding && !editingId ? (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={startAdd}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          ) : undefined
        }
        tabs={
          <SegmentedControl
            options={[
              { value: 'activos', label: 'Activos', count: activos.length },
              { value: 'inactivos', label: 'Inactivos', count: inactivos.length },
            ]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as 'activos' | 'inactivos')}
          />
        }
      >
        {activeTab === 'activos' && (
          <div className="space-y-4" role="tabpanel">
            <div className="flex w-full flex-wrap items-center gap-1 rounded-lg bg-muted p-1 sm:w-fit">
              {([
                { v: 'todos' as TypeFilter, label: 'Todos' },
                { v: 'servicios' as TypeFilter, label: 'Servicios' },
                { v: 'productos' as TypeFilter, label: 'Productos' },
              ]).map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setTypeFilter(opt.v)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors sm:flex-none ${
                    typeFilter === opt.v
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {activos.length === 0 && inactivos.length === 0 && !isAdding ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No hay descuentos para mostrar.
                </p>
                <Button variant="outline" size="sm" className="mt-3 w-full sm:w-auto" onClick={startAdd}>
                  <Plus className="h-4 w-4 mr-1" /> Crear el primero
                </Button>
              </div>
            ) : activos.length === 0 && !isAdding ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No hay descuentos activos{typeFilter !== 'todos' ? ' en esta categoría' : ''}.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {visible.map(renderRow)}
                {showDivider && (
                  <ShowMoreDivider count={hiddenCount} onClick={toggle} expanded={expanded} label="descuentos más" />
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'inactivos' && (
          <div className="space-y-4" role="tabpanel">
            <div className="flex w-full flex-wrap items-center gap-1 rounded-lg bg-muted p-1 sm:w-fit">
              {([
                { v: 'todos' as TypeFilter, label: 'Todos' },
                { v: 'servicios' as TypeFilter, label: 'Servicios' },
                { v: 'productos' as TypeFilter, label: 'Productos' },
              ]).map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setTypeFilter(opt.v)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors sm:flex-none ${
                    typeFilter === opt.v
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {inactivos.length > 0 ? (
              <div className="space-y-2">
                {inactivos.map(renderRow)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No hay descuentos inactivos{typeFilter !== 'todos' ? ' en esta categoría' : ''}.
                </p>
              </div>
            )}
          </div>
        )}
      </CatalogSectionCard>

      <DrawerForm
        open={isAdding || editingId !== null}
        onOpenChange={(o) => { if (!o) closeDrawer(); }}
        title={isAdding ? 'Agregar descuento' : 'Editar descuento'}
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
          ) : editingDiscount ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <div className="w-px h-5 bg-border" />
              {canToggle && editingIsActive ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDeactivateConfirm(editingDiscount);
                    closeDrawer();
                  }}
                  className="bg-status-warning text-white hover:bg-status-warning/90"
                >
                  Desactivar
                </Button>
              ) : canToggle ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      onToggleActive!(editingDiscount.id, true);
                      toast.success('Descuento activado');
                      closeDrawer();
                    }}
                    className="bg-status-success-bg text-status-success-foreground hover:bg-status-success/15"
                  >
                    Activar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setDeleteConfirm(editingDiscount);
                      closeDrawer();
                    }}
                  >
                    Eliminar
                  </Button>
                </>
              ) : null}
            </div>
          ) : null
        }
      >
        <Form {...form}>
          <FormFields />
        </Form>
      </DrawerForm>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar descuento</AlertDialogTitle>
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

      <AlertDialog open={!!deactivateConfirm} onOpenChange={(open) => !open && setDeactivateConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar descuento</AlertDialogTitle>
            <AlertDialogDescription>
              Este descuento dejará de estar disponible. Podés volver a activarlo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeactivate} className="bg-status-warning text-white hover:bg-status-warning/90">
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
