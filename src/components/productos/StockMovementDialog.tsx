import { useState, useEffect } from 'react';
import { DrawerForm } from '@/components/ui/drawer-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, PackagePlus, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductoConSucursal } from './types';

type Tipo = 'stock_inicial' | 'reposicion' | 'ajuste_manual';

interface Props {
  open: boolean;
  item: ProductoConSucursal;
  tipo: Tipo;
  onClose: () => void;
  onSaved: () => void;
}

const LABELS: Record<Tipo, { title: string; desc: string; cta: string; icon: any; cantidadLabel: string; signo: 'positivo' | 'libre' }> = {
  stock_inicial: {
    title: 'Cargar stock inicial',
    desc: 'Establecé la cantidad inicial disponible en esta sucursal. Quedará registrado como "Stock inicial" en el historial.',
    cta: 'Cargar stock inicial',
    icon: PackagePlus,
    cantidadLabel: 'Cantidad inicial',
    signo: 'positivo',
  },
  reposicion: {
    title: 'Agregar stock',
    desc: 'Sumá unidades al stock actual (compra, reposición, devolución de proveedor).',
    cta: 'Agregar stock',
    icon: PackagePlus,
    cantidadLabel: 'Cantidad a agregar',
    signo: 'positivo',
  },
  ajuste_manual: {
    title: 'Ajustar stock',
    desc: 'Ajustá el stock indicando una cantidad positiva (suma) o negativa (resta). Requiere motivo.',
    cta: 'Registrar ajuste',
    icon: Settings2,
    cantidadLabel: 'Ajuste (+ o -)',
    signo: 'libre',
  },
};

export function StockMovementDialog({ open, item, tipo, onClose, onSaved }: Props) {
  const cfg = LABELS[tipo];
  const ps = item.sucursal;
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCantidad('');
      setMotivo('');
    }
  }, [open, tipo, item.producto.id]);

  if (!ps) return null;

  const cantidadNum = parseFloat(cantidad);
  const cantidadValida = !isNaN(cantidadNum) && (cfg.signo === 'positivo' ? cantidadNum > 0 : cantidadNum !== 0);
  const stockProyectado = ps.stock_actual + (isNaN(cantidadNum) ? 0 : cantidadNum);
  const seraNegativo = stockProyectado < 0;
  const motivoOk = tipo !== 'ajuste_manual' || motivo.trim().length > 0;
  const canSave = cantidadValida && motivoOk && !saving;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Para "stock_inicial" la cantidad debe ser un set absoluto (delta = inicial - actual)
      let delta = cantidadNum;
      if (tipo === 'stock_inicial') {
        delta = cantidadNum - ps.stock_actual;
        if (delta === 0) {
          toast.info('No hay cambios respecto al stock actual');
          setSaving(false);
          return;
        }
      }
      const { error } = await supabase.rpc('registrar_movimiento_stock', {
        _producto_sucursal_id: ps.id,
        _tipo: tipo,
        _cantidad: delta,
        _motivo: motivo.trim() || null,
        _venta_id: null,
      });
      if (error) throw error;
      toast.success('Movimiento registrado');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo registrar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DrawerForm
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={cfg.title}
      size="sm"
      footer={
        <div className="flex w-full justify-between">
          <Button variant="ghost" disabled={saving} onClick={() => onClose()}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave}>
            {saving ? 'Guardando...' : cfg.cta}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">{cfg.desc}</p>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-sm font-medium text-foreground">{item.producto.nombre}</p>
          {item.marca && <p className="text-xs text-muted-foreground">{item.marca.nombre}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            Stock actual: <span className="text-foreground font-medium">{ps.stock_actual}</span>
          </p>
        </div>

        <div className="space-y-2">
          <Label>{cfg.cantidadLabel}</Label>
          <Input
            inputMode="decimal"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value.replace(/[^\d.\-]/g, ''))}
            placeholder={cfg.signo === 'libre' ? 'Ej: -3 o 5' : 'Ej: 10'}
            autoFocus
          />
          {cantidadValida && (
            <p className="text-xs text-muted-foreground">
              Stock resultante: <span className="text-foreground font-medium">{stockProyectado}</span>
            </p>
          )}
        </div>

        {tipo === 'ajuste_manual' && (
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: rotura, recuento físico, error de carga..."
              maxLength={240}
              rows={2}
            />
            <p className="text-xs text-muted-foreground text-right">{motivo.length}/240</p>
          </div>
        )}

        {tipo !== 'ajuste_manual' && (
          <div className="space-y-2">
            <Label>Nota <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Referencia, proveedor, etc."
              maxLength={80}
            />
          </div>
        )}

        {seraNegativo && cantidadValida && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              El stock quedará en negativo. Está permitido pero conviene revisar el conteo físico.
            </p>
          </div>
        )}
      </div>
    </DrawerForm>
  );
}
