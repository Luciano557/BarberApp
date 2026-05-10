import { useMemo, useState } from 'react';
import { Plus, Edit2, Save, X, Power, PowerOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Discount, DiscountAppliesTo } from '@/types/barbershop';
import { toast } from 'sonner';

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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Discount | null>(null);

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

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'efectivo': return 'Solo Efectivo';
      case 'mercado_pago': return 'Solo QR';
      default: return 'Todos';
    }
  };

  const getRoundingLabel = (rounding: string, unit?: number) => {
    const unitLabel = unit && unit !== 1 ? ` (×${unit})` : '';
    switch (rounding) {
      case 'negocio': return `↑ Negocio${unitLabel}`;
      case 'matematico': return `≈ Matemático${unitLabel}`;
      default: return `↓ Cliente${unitLabel}`;
    }
  };

  const filtered = useMemo(() => {
    if (typeFilter === 'todos') return discounts;
    return discounts.filter(d => (d.appliesTo || 'servicios') === typeFilter);
  }, [discounts, typeFilter]);

  const flagFor = (d: Discount) => isGlobal ? (d.globalActive ?? d.active) : d.active;
  const activos = filtered.filter(d => flagFor(d));
  const inactivos = filtered.filter(d => !flagFor(d));

  const Form = ({ isEdit = false, id = '' }: { isEdit?: boolean; id?: string }) => (
    <div className="space-y-4 p-4 bg-muted rounded-lg animate-scale-in">
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
      <div className="flex gap-2 justify-end pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { if (isEdit) setEditingId(null); else setIsAdding(false); resetForm(); }}
        >
          <X className="h-4 w-4 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={() => isEdit ? handleUpdate(id) : handleAdd()} className="bg-success hover:bg-success/90">
          <Save className="h-4 w-4 mr-1" /> {isEdit ? 'Guardar' : 'Agregar'}
        </Button>
      </div>
    </div>
  );

  const renderRow = (d: Discount) => (
    <div key={d.id}>
      {editingId === d.id ? (
        <Form isEdit id={d.id} />
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground">{d.label}</span>
              <span className="text-sm px-2 py-0.5 rounded bg-primary/10 text-primary">
                {d.type === 'fixed' ? `$${d.value.toLocaleString('es-AR')}` : `${d.value}%`}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                {(d.appliesTo || 'servicios') === 'productos' ? 'Productos' : 'Servicios'}
              </span>
              {d.type === 'percentage' && (
                <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {getRoundingLabel(d.rounding, d.roundingUnit)}
                </span>
              )}
              {d.paymentMethod !== 'todos' && (
                <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
                  {getPaymentMethodLabel(d.paymentMethod)}
                </span>
              )}
              {!d.active && (
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  Inactivo
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => startEdit(d)} className="h-8 w-8" title="Editar">
              <Edit2 className="h-4 w-4" />
            </Button>
            {onToggleActive && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onToggleActive(d.id, !flagFor(d))}
                className="h-8 w-8"
                title={flagFor(d) ? 'Desactivar' : 'Activar'}
              >
                {flagFor(d) ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-success" />}
              </Button>
            )}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={flagFor(d)}
                      onClick={() => !flagFor(d) && setDeleteConfirm(d)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive disabled:opacity-40"
                      title={flagFor(d) ? undefined : 'Eliminar'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {flagFor(d) && (
                  <TooltipContent>Para eliminar este elemento, primero debes desactivarlo.</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-medium">Descuentos</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Creá descuentos para servicios o productos. Los inactivos no aparecen en Cobrar.
          </p>
        </div>
        {!isAdding && !editingId && (
          <Button variant="outline" size="sm" onClick={startAdd}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtro simple por tipo */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-full sm:w-fit">
          {([
            { v: 'todos' as TypeFilter, label: 'Todos' },
            { v: 'servicios' as TypeFilter, label: 'Servicios' },
            { v: 'productos' as TypeFilter, label: 'Productos' },
          ]).map(opt => (
            <button
              key={opt.v}
              onClick={() => setTypeFilter(opt.v)}
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                typeFilter === opt.v
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {isAdding && <Form />}

        {activos.length === 0 && inactivos.length === 0 && !isAdding && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No hay descuentos para mostrar.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={startAdd}>
              <Plus className="h-4 w-4 mr-1" /> Crear el primero
            </Button>
          </div>
        )}

        {activos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activos</p>
            {activos.map(renderRow)}
          </div>
        )}

        {inactivos.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inactivos</p>
            {inactivos.map(renderRow)}
          </div>
        )}
      </CardContent>

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
    </Card>
  );
}

