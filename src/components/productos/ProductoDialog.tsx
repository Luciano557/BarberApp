import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Marca, ProductoConSucursal } from './types';

interface Props {
  open: boolean;
  producto: ProductoConSucursal | null; // null = nuevo
  marcas: Marca[];
  sucursalId: string;
  onClose: () => void;
  onSaved: () => void;
  onManageMarcas: () => void;
}

const NO_BRAND = '__none__';

export function ProductoDialog({ open, producto, marcas, sucursalId, onClose, onSaved, onManageMarcas }: Props) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const isNew = !producto;

  // Datos globales
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [marcaId, setMarcaId] = useState<string>(NO_BRAND);

  // Datos de sucursal
  const [activoSucursal, setActivoSucursal] = useState(true);
  const [precioCosto, setPrecioCosto] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  // Stock inicial solo en creación de vínculo (si no existe productos_sucursal)
  const [stockInicial, setStockInicial] = useState('');
  // Compensación por venta
  const [comisionModo, setComisionModo] = useState<'barbero' | 'ninguna' | 'personalizada'>('barbero');
  const [comisionPct, setComisionPct] = useState('');

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('datos');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab('datos');
    setSubmitAttempted(false);
    if (producto) {
      setNombre(producto.producto.nombre);
      setDescripcion(producto.producto.descripcion || '');
      setMarcaId(producto.producto.marca_id || NO_BRAND);
      const ps = producto.sucursal;
      setActivoSucursal(ps?.activo ?? true);
      setPrecioCosto(ps?.precio_costo != null ? String(ps.precio_costo) : '');
      setPrecioVenta(ps?.precio_venta != null ? String(ps.precio_venta) : '');
      setStockMinimo(ps?.stock_minimo != null ? String(ps.stock_minimo) : '');
      setStockInicial('');
      setComisionModo((ps?.comision_modo as any) || 'barbero');
      setComisionPct(ps?.comision_porcentaje != null ? String(ps.comision_porcentaje) : '');
    } else {
      setNombre('');
      setDescripcion('');
      setMarcaId(NO_BRAND);
      setActivoSucursal(true);
      setPrecioCosto('');
      setPrecioVenta('');
      setStockMinimo('');
      setStockInicial('');
      setComisionModo('barbero');
      setComisionPct('');
    }
  }, [open, producto]);

  const margenPct = useMemo(() => {
    const c = parseFloat(precioCosto);
    const v = parseFloat(precioVenta);
    if (!c || !v || c <= 0) return null;
    return ((v - c) / c) * 100;
  }, [precioCosto, precioVenta]);

  const tabErrors = useMemo(() => ({
    datos: nombre.trim().length === 0,
    precio: parseFloat(precioVenta) < 0 || isNaN(parseFloat(precioVenta)),
    comision: comisionModo === 'personalizada' && (
      isNaN(parseFloat(comisionPct)) ||
      parseFloat(comisionPct) < 0 ||
      parseFloat(comisionPct) > 100
    ),
  }), [nombre, precioVenta, comisionModo, comisionPct]);

  const canSave = nombre.trim().length > 0 && parseFloat(precioVenta) >= 0 && !saving;

  const handleSave = async () => {
    if (!orgId) return;
    setSubmitAttempted(true);

    if (tabErrors.datos) {
      setActiveTab('datos');
      toast.error('Completá el nombre del producto.');
      return;
    }
    if (tabErrors.precio) {
      setActiveTab('precio');
      toast.error('Completá el precio de venta.');
      return;
    }
    if (tabErrors.comision) {
      setActiveTab('comision');
      toast.error('Revisá la configuración de comisión.');
      return;
    }

    // Validación de comisión personalizada
    let comision_porcentaje: number | null = null;
    if (comisionModo === 'personalizada') {
      const n = parseFloat(comisionPct.replace(',', '.'));
      if (isNaN(n) || n < 0 || n > 100) {
        toast.error('Ingresá un porcentaje de comisión entre 0 y 100');
        return;
      }
      comision_porcentaje = n;
    }
    setSaving(true);
    try {
      const nombreNorm = nombre.replace(/\s+/g, ' ').trim();
      const marca_id = marcaId === NO_BRAND ? null : marcaId;
      const precio_costo = precioCosto ? parseFloat(precioCosto) : null;
      const precio_venta = precioVenta ? parseFloat(precioVenta) : 0;
      const stock_minimo = stockMinimo ? parseFloat(stockMinimo) : 0;

      if (comisionModo !== 'ninguna' && precio_costo == null) {
        toast.error('Para que el producto genere comisión, cargá un precio de costo.');
        setSaving(false);
        return;
      }

      let productoId: string;

      if (isNew) {
        const { data, error } = await supabase
          .from('productos')
          .insert({
            organization_id: orgId,
            marca_id,
            nombre: nombreNorm,
            descripcion: descripcion.trim() || null,
            activo: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        productoId = data.id;
      } else {
        productoId = producto!.producto.id;
        const { error } = await supabase
          .from('productos')
          .update({
            marca_id,
            nombre: nombreNorm,
            descripcion: descripcion.trim() || null,
          })
          .eq('id', productoId);
        if (error) throw error;
      }

      // Upsert productos_sucursal
      const existingPs = producto?.sucursal;
      if (existingPs) {
        const { error } = await supabase
          .from('productos_sucursal')
          .update({
            activo: activoSucursal,
            precio_costo,
            precio_venta,
            margen_pct: margenPct,
            stock_minimo,
            comision_modo: comisionModo,
            comision_porcentaje,
          } as any)
          .eq('id', existingPs.id);
        if (error) throw error;
      } else {
        // Crear vínculo de sucursal
        const { data: psData, error } = await supabase
          .from('productos_sucursal')
          .insert({
            organization_id: orgId,
            sucursal_id: sucursalId,
            producto_id: productoId,
            activo: activoSucursal,
            precio_costo,
            precio_venta,
            margen_pct: margenPct,
            stock_minimo,
            stock_actual: 0,
            comision_modo: comisionModo,
            comision_porcentaje,
          } as any)
          .select('id')
          .single();
        if (error) throw error;

        // Si carga stock inicial, registrar movimiento
        const inicial = parseFloat(stockInicial);
        if (psData && !isNaN(inicial) && inicial !== 0) {
          const { error: movErr } = await supabase.rpc('registrar_movimiento_stock', {
            _producto_sucursal_id: psData.id,
            _tipo: 'stock_inicial',
            _cantidad: inicial,
            _motivo: 'Carga inicial al crear producto',
            _venta_id: null,
          });
          if (movErr) {
            toast.error('Producto creado pero falló el stock inicial: ' + movErr.message);
          }
        }
      }

      toast.success(isNew ? 'Producto creado' : 'Producto actualizado');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Nuevo producto' : 'Editar producto'}</DialogTitle>
          <DialogDescription>
            Los datos generales se aplican a toda la organización. Los precios y stock son por sucursal.
          </DialogDescription>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 mt-2">
            <div>
              <p className="text-sm font-medium">Activo en esta sucursal</p>
              <p className="text-xs text-muted-foreground">Si está inactivo, no aparecerá en el cobro.</p>
            </div>
            <Switch checked={activoSucursal} onCheckedChange={setActivoSucursal} />
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="datos" className="relative">
              Datos
              {submitAttempted && tabErrors.datos && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
            <TabsTrigger value="precio" className="relative">
              Precio y stock
              {submitAttempted && tabErrors.precio && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
            <TabsTrigger value="comision" className="relative">
              Comisión
              {submitAttempted && tabErrors.comision && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="datos" className="space-y-3 mt-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Cera matte 100ml"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label>Marca</Label>
              <div className="flex gap-2">
                <Select value={marcaId} onValueChange={setMarcaId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Sin marca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BRAND}>Sin marca</SelectItem>
                    {marcas.filter(m => m.activo).map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                          {m.nombre}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={onManageMarcas}>
                  Gestionar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={240}
                rows={2}
              />
              <p className="text-xs text-muted-foreground text-right">{descripcion.length}/240</p>
            </div>
          </TabsContent>

          <TabsContent value="precio" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Precio costo</Label>
                <CurrencyInput value={precioCosto} onChange={setPrecioCosto} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Precio venta</Label>
                <CurrencyInput value={precioVenta} onChange={setPrecioVenta} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Margen estimado</Label>
                <div className="h-10 px-3 flex items-center rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
                  {margenPct != null ? `${margenPct.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Stock mínimo</Label>
                <Input
                  inputMode="numeric"
                  value={stockMinimo}
                  onChange={(e) => setStockMinimo(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="0"
                />
              </div>
            </div>
            {(isNew || !producto?.sucursal) ? (
              <div className="space-y-2">
                <Label>Stock inicial <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  inputMode="numeric"
                  value={stockInicial}
                  onChange={(e) => setStockInicial(e.target.value.replace(/[^\d.\-]/g, ''))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Se registrará como movimiento "Stock inicial" en el historial.
                </p>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="comision" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              Define cómo genera comisión este producto cuando lo vende un barbero. La comisión se calcula sobre la ganancia (precio de venta − precio de costo).
            </p>
            <Select value={comisionModo} onValueChange={(v: any) => setComisionModo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="barbero">Usar regla del barbero</SelectItem>
                <SelectItem value="ninguna">No generar comisión</SelectItem>
                <SelectItem value="personalizada">Comisión personalizada</SelectItem>
              </SelectContent>
            </Select>
            {comisionModo === 'personalizada' && (
              <div className="space-y-1">
                <Label>Porcentaje (%)</Label>
                <Input
                  inputMode="decimal"
                  value={comisionPct}
                  onChange={(e) => setComisionPct(e.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0"
                  maxLength={6}
                />
              </div>
            )}
            {comisionModo !== 'ninguna' && !precioCosto && (
              <p className="text-xs text-status-warning-foreground">
                Falta el precio de costo. Completalo en la pestaña Precio y stock para que el producto genere comisión.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
