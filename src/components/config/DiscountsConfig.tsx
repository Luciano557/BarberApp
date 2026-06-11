import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, MoreVertical, BadgePercent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Discount, DiscountAppliesTo } from '@/types/barbershop';
import { DrawerForm } from '@/components/ui/drawer-form';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TabBadge } from '@/components/ui/TabBadge';

function validateDiscountName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'El nombre no puede estar vacío.';
  if (trimmed.length > 80) return 'El nombre no puede superar los 80 caracteres.';
  return null;
}

function validateDiscountValue(raw: string, type: 'percentage' | 'fixed'): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = (raw || '').toString().trim();
  if (!cleaned) {
    return { ok: false, error: type === 'percentage'
      ? 'El porcentaje debe ser mayor a 0 y menor o igual a 100.'
      : 'El monto debe ser mayor a 0.' };
  }
  const value = parseFloat(cleaned);
  if (Number.isNaN(value)) {
    return { ok: false, error: 'Ingresá un valor numérico válido.' };
  }
  if (type === 'percentage') {
    if (value <= 0 || value > 100) {
      return { ok: false, error: 'El porcentaje debe ser mayor a 0 y menor o igual a 100.' };
    }
  } else if (value <= 0) {
    return { ok: false, error: 'El monto debe ser mayor a 0.' };
  }
  return { ok: true, value };
}

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

  // Form state
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<'percentage' | 'fixed'>('percentage');
  const [newRounding, setNewRounding] = useState<'cliente' | 'negocio' | 'matematico'>('cliente');
  const [newRoundingUnit, setNewRoundingUnit] = useState<number>(100);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'todos' | 'efectivo' | 'mercado_pago'>('todos');
  const [newAppliesTo, setNewAppliesTo] = useState<DiscountAppliesTo>('servicios');

  const resetForm = () => {
    setNewLabel('');
    setNewValue('');
    setNewType('percentage');
    setNewRounding('cliente');
    setNewRoundingUnit(100);
    setNewPaymentMethod('todos');
    setNewAppliesTo(typeFilter === 'productos' ? 'productos' : 'servicios');
  };

  const startAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleAdd = () => {
    const nameErr = validateDiscountName(newLabel);
    if (nameErr) { toast.error(nameErr); return; }
    const v = validateDiscountValue(newValue, newType);
    if (v.ok === false) { toast.error(v.error); return; }
    onAdd({
      label: newLabel.trim(),
      value: v.value,
      type: newType,
      rounding: newRounding,
      roundingUnit: newRoundingUnit,
      paymentMethod: newPaymentMethod,
      appliesTo: newAppliesTo,
      active: true,
    });
    resetForm();
    setIsAdding(false);
  };

  const handleUpdate = (id: string) => {
    const nameErr = validateDiscountName(newLabel);
    if (nameErr) { toast.error(nameErr); return; }
    const v = validateDiscountValue(newValue, newType);
    if (v.ok === false) { toast.error(v.error); return; }
    onUpdate(id, {
      label: newLabel.trim(),
      value: v.value,
      type: newType,
      rounding: newRounding,
      roundingUnit: newRoundingUnit,
      paymentMethod: newPaymentMethod,
      appliesTo: newAppliesTo,
    });
    setEditingId(null);
    resetForm();
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
    setNewLabel(d.label);
    setNewValue(d.value.toString());
    setNewType(d.type || 'percentage');
    setNewRounding(d.rounding || 'cliente');
    setNewRoundingUnit(d.roundingUnit || 100);
    setNewPaymentMethod(d.paymentMethod || 'todos');
    setNewAppliesTo(d.appliesTo || 'servicios');
  };

  const filtered = useMemo(() => {
    if (typeFilter === 'todos') return discounts;
    return discounts.filter(d => (d.appliesTo || 'servicios') === typeFilter);
  }, [discounts, typeFilter]);

  const flagFor = (d: Discount) => isGlobal ? (d.globalActive ?? d.active) : d.active;
  const activos = filtered.filter(d => flagFor(d));
  const inactivos = filtered.filter(d => !flagFor(d));
  const editingDiscount = editingId ? (discounts.find(d => d.id === editingId) ?? null) : null;
  const editingIsActive = editingDiscount ? flagFor(editingDiscount) : false;
  const canToggle = !!onToggleActive && !(!isGlobal && editingDiscount?.globalActive === false);

  const Form = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nombre</label>
          <Input
            placeholder="Ej: Promo Amigo"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Aplica a</label>
          <Select value={newAppliesTo} onValueChange={(v) => setNewAppliesTo(v as DiscountAppliesTo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="servicios">Servicios</SelectItem>
              <SelectItem value="productos">Productos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select value={newType} onValueChange={(v) => setNewType(v as 'percentage' | 'fixed')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Porcentaje (%)</SelectItem>
              <SelectItem value="fixed">Monto Fijo ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{newType === 'percentage' ? 'Porcentaje' : 'Monto'}</label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder={newType === 'percentage' ? '% (ej: 15)' : '$ (ej: 1000)'}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            min="0"
            max={newType === 'percentage' ? 100 : undefined}
          />
        </div>
        {newType === 'percentage' && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tipo de Redondeo</label>
              <Select value={newRounding} onValueChange={(v) => setNewRounding(v as 'cliente' | 'negocio' | 'matematico')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">↓ Favor Cliente (redondea hacia abajo)</SelectItem>
                  <SelectItem value="negocio">↑ Favor Negocio (redondea hacia arriba)</SelectItem>
                  <SelectItem value="matematico">≈ Al más cercano (redondeo matemático)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Unidad de Redondeo</label>
              <Select value={newRoundingUnit.toString()} onValueChange={(v) => setNewRoundingUnit(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROUNDING_UNITS.map(unit => (
                    <SelectItem key={unit} value={unit.toString()}>
                      {unit === 1 ? 'Sin redondeo (exacto)' : `A ${unit}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Aplica con método de pago</label>
          <Select value={newPaymentMethod} onValueChange={(v) => setNewPaymentMethod(v as 'todos' | 'efectivo' | 'mercado_pago')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los métodos</SelectItem>
              <SelectItem value="efectivo">Solo Efectivo</SelectItem>
              <SelectItem value="mercado_pago">Solo QR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderRow = (d: Discount) => {
    const appliesTo = d.appliesTo || 'servicios';
    const categoryLabel = appliesTo === 'productos' ? 'Productos' : 'Servicios';
    const categoryClass = appliesTo === 'productos'
      ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]'
      : 'bg-[#EEF2FF] text-[#3730A3] border border-[#C7D2FE]';
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
            <Badge variant="category" className={categoryClass}>{categoryLabel}</Badge>
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
    <Card className="border border-border bg-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-muted p-2">
              <BadgePercent className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">
                {isGlobal ? 'Reglas de descuento' : 'Descuentos disponibles'}
              </CardTitle>
              <CardDescription>
                {isGlobal
                  ? 'Por porcentaje o monto fijo. Pueden aplicar a servicios, productos o ambos.'
                  : 'Activá o desactivá los descuentos para esta sucursal.'}
              </CardDescription>
            </div>
          </div>
          {!isAdding && !editingId && (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={startAdd}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'activos' | 'inactivos')}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-md bg-muted/50 p-1">
            <TabsTrigger value="activos" className="group min-h-8 whitespace-normal px-2 text-xs data-[state=active]:bg-card">
              Activos<TabBadge count={activos.length} />
            </TabsTrigger>
            <TabsTrigger value="inactivos" className="group min-h-8 whitespace-normal px-2 text-xs data-[state=active]:bg-card">
              Inactivos<TabBadge count={inactivos.length} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activos" className="mt-4 space-y-4">
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
                {activos.map(renderRow)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="inactivos" className="mt-4 space-y-4">
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
          </TabsContent>
        </Tabs>
      </CardContent>

      <DrawerForm
        open={isAdding || editingId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setIsAdding(false);
            setEditingId(null);
            resetForm();
          }
        }}
        title={isAdding ? 'Agregar descuento' : 'Editar descuento'}
        size="sm"
        footer={
          isAdding ? (
            <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={() => { setIsAdding(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleAdd}>Guardar</Button>
            </div>
          ) : editingDiscount ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button onClick={() => handleUpdate(editingDiscount.id)}>
                Guardar cambios
              </Button>
              <div className="w-px h-5 bg-border" />
              {canToggle && editingIsActive ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDeactivateConfirm(editingDiscount);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
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
                      setEditingId(null);
                      resetForm();
                    }}
                    className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                  >
                    Activar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDeleteConfirm(editingDiscount);
                      setEditingId(null);
                      resetForm();
                    }}
                    className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                  >
                    Eliminar
                  </Button>
                </>
              ) : null}
            </div>
          ) : null
        }
      >
        <Form />
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
            <AlertDialogAction onClick={handleConfirmDeactivate} className="bg-amber-500 text-white hover:bg-amber-600">
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

