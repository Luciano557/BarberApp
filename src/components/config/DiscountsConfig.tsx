import { useState } from 'react';
import { Plus, Edit2, Save, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Discount } from '@/types/barbershop';

interface DiscountsConfigProps {
  discounts: Discount[];
  onAdd: (discount: Omit<Discount, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Discount>) => void;
  onDelete: (id: string) => void;
}

export function DiscountsConfig({ discounts, onAdd, onUpdate, onDelete }: DiscountsConfigProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<'percentage' | 'fixed'>('percentage');
  const [newRounding, setNewRounding] = useState<'cliente' | 'negocio' | 'matematico'>('cliente');
  const [newRoundingUnit, setNewRoundingUnit] = useState<number>(100);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'todos' | 'efectivo' | 'mercado_pago'>('todos');

  const ROUNDING_UNITS = [1, 10, 50, 100, 500, 1000];

  const resetForm = () => {
    setNewLabel(''); setNewValue(''); setNewType('percentage');
    setNewRounding('cliente'); setNewRoundingUnit(100); setNewPaymentMethod('todos');
  };

  const handleAdd = () => {
    if (newLabel && newValue) {
      onAdd({ label: newLabel, value: parseFloat(newValue), type: newType, rounding: newRounding, roundingUnit: newRoundingUnit, paymentMethod: newPaymentMethod });
      resetForm(); setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (newLabel && newValue) {
      onUpdate(id, { label: newLabel, value: parseFloat(newValue), type: newType, rounding: newRounding, roundingUnit: newRoundingUnit, paymentMethod: newPaymentMethod });
      setEditingId(null); resetForm();
    }
  };

  const startEdit = (discount: Discount) => {
    setEditingId(discount.id);
    setNewLabel(discount.label); setNewValue(discount.value.toString());
    setNewType(discount.type || 'percentage'); setNewRounding(discount.rounding || 'cliente');
    setNewRoundingUnit(discount.roundingUnit || 100); setNewPaymentMethod(discount.paymentMethod || 'todos');
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) { case 'efectivo': return 'Solo Efectivo'; case 'mercado_pago': return 'Solo QR'; default: return 'Todos'; }
  };

  const getRoundingLabel = (rounding: string, unit?: number) => {
    const unitLabel = unit && unit !== 1 ? ` (×${unit})` : '';
    switch (rounding) { case 'cliente': return `↓ Cliente${unitLabel}`; case 'negocio': return `↑ Negocio${unitLabel}`; case 'matematico': return `≈ Matemático${unitLabel}`; default: return `↓ Cliente${unitLabel}`; }
  };

  const DiscountForm = ({ isEdit = false, discountId = '' }: { isEdit?: boolean; discountId?: string }) => (
    <div className="space-y-4 p-4 bg-muted rounded-lg animate-scale-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nombre</label>
          <Input placeholder="Ej: Promo Amigo" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
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
          <Input type="number" placeholder={newType === 'percentage' ? '% (ej: 15)' : '$ (ej: 1000)'} value={newValue} onChange={(e) => setNewValue(e.target.value)} min="0" max={newType === 'percentage' ? 100 : undefined} />
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
                      {unit === 1 ? 'Sin redondeo (exacto)' : `A ${unit} (ej: ${unit * 12} → ${Math.round((unit * 12) / unit) * unit})`}
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
              <SelectItem value="mercado_pago">Solo Mercado Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="ghost" size="sm" onClick={() => { if (isEdit) setEditingId(null); else setIsAdding(false); resetForm(); }}>
          <X className="h-4 w-4 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={() => isEdit ? handleUpdate(discountId) : handleAdd()} className="bg-success hover:bg-success/90">
          <Save className="h-4 w-4 mr-1" /> {isEdit ? 'Guardar' : 'Agregar'}
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Descuentos Predefinidos</CardTitle>
        {!isAdding && !editingId && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          Configura descuentos por porcentaje o monto fijo, con opciones de redondeo y restricción por método de pago.
        </p>
        {isAdding && <DiscountForm />}
        {discounts.map((discount) => (
          <div key={discount.id}>
            {editingId === discount.id ? (
              <DiscountForm isEdit discountId={discount.id} />
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{discount.label}</span>
                    <span className="text-sm px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {discount.type === 'fixed' ? `$${discount.value.toLocaleString()}` : `${discount.value}%`}
                    </span>
                    {discount.type === 'percentage' && discount.id !== 'none' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                        {getRoundingLabel(discount.rounding, discount.roundingUnit)}
                      </span>
                    )}
                    {discount.paymentMethod !== 'todos' && discount.id !== 'none' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
                        {getPaymentMethodLabel(discount.paymentMethod)}
                      </span>
                    )}
                  </div>
                </div>
                {discount.id !== 'none' && (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(discount)} className="h-8 w-8">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(discount.id)} className="text-destructive hover:text-destructive h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
