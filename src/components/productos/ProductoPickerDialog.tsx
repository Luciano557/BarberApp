import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Minus, Package, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Marca, Producto, ProductoSucursal } from './types';
import { Badge } from '@/components/ui/badge';

const isPriceMissing = (p: number | null | undefined) => !p || p <= 0;
export interface CartItem {
  producto_id: string;
  producto_sucursal_id: string;
  nombre: string;
  marca_id: string | null;
  marca_nombre: string | null;
  precio_unitario: number;
  precio_default: number;
  cantidad: number;
  stock_actual: number;
}

interface ProductoPickerDialogProps {
  open: boolean;
  sucursalId: string;
  canEditPrice: boolean;
  initialCart: CartItem[];
  onClose: () => void;
  onConfirm: (cart: CartItem[]) => void;
}

interface RowData {
  producto: Producto;
  marca: Marca | null;
  sucursal: ProductoSucursal;
}

export function ProductoPickerDialog({
  open,
  sucursalId,
  canEditPrice,
  initialCart,
  onClose,
  onConfirm,
}: ProductoPickerDialogProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());

  const fetchRows = useCallback(async () => {
    if (!orgId || !sucursalId) return;
    setLoading(true);
    const [m, p, ps] = await Promise.all([
      supabase.from('marcas_producto').select('*').eq('organization_id', orgId),
      supabase.from('productos').select('*').eq('organization_id', orgId).eq('activo', true),
      supabase.from('productos_sucursal').select('*').eq('organization_id', orgId).eq('sucursal_id', sucursalId).eq('activo', true),
    ]);
    if (m.error || p.error || ps.error) {
      toast.error('No se pudieron cargar los productos');
      setLoading(false);
      return;
    }
    const marcasMap = new Map((m.data || []).map((x: any) => [x.id, x as Marca]));
    const productosMap = new Map((p.data || []).map((x: any) => [x.id, x as Producto]));
    const data: RowData[] = (ps.data || [])
      .map((s: any) => {
        const prod = productosMap.get(s.producto_id);
        if (!prod) return null;
        return {
          producto: prod,
          marca: prod.marca_id ? marcasMap.get(prod.marca_id) || null : null,
          sucursal: s as ProductoSucursal,
        } as RowData;
      })
      .filter((x): x is RowData => x !== null)
      .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre));
    setRows(data);
    setLoading(false);
  }, [orgId, sucursalId]);

  useEffect(() => {
    if (open) {
      fetchRows();
      const initialMap = new Map<string, CartItem>();
      initialCart.forEach(it => initialMap.set(it.producto_sucursal_id, { ...it }));
      setCart(initialMap);
      setSearch('');
    }
  }, [open, fetchRows, initialCart]);


  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      r.producto.nombre.toLowerCase().includes(s) ||
      (r.marca?.nombre.toLowerCase().includes(s) ?? false)
    );
  }, [rows, search]);

  const updateQty = (row: RowData, delta: number) => {
    if (delta > 0 && isPriceMissing(Number(row.sucursal.precio_venta))) {
      toast.error('Definí un precio para este ítem antes de cobrarlo.');
      return;
    }
    setCart(prev => {
      const next = new Map(prev);
      const key = row.sucursal.id;
      const existing = next.get(key);
      const currentQty = existing?.cantidad || 0;
      const newQty = currentQty + delta;
      if (newQty <= 0) {
        next.delete(key);
      } else {
        next.set(key, {
          producto_id: row.producto.id,
          producto_sucursal_id: row.sucursal.id,
          nombre: row.producto.nombre,
          marca_id: row.marca?.id || null,
          marca_nombre: row.marca?.nombre || null,
          precio_unitario: existing?.precio_unitario ?? Number(row.sucursal.precio_venta),
          precio_default: Number(row.sucursal.precio_venta),
          cantidad: newQty,
          stock_actual: Number(row.sucursal.stock_actual),
        });
      }
      return next;
    });
  };

  const updatePrice = (key: string, value: string) => {
    const num = parseFloat(value) || 0;
    setCart(prev => {
      const next = new Map(prev);
      const item = next.get(key);
      if (item) {
        next.set(key, { ...item, precio_unitario: num });
      }
      return next;
    });
  };

  const totalCarrito = useMemo(() => {
    let total = 0;
    cart.forEach(it => { total += it.precio_unitario * it.cantidad; });
    return total;
  }, [cart]);

  const handleConfirm = () => {
    const items = Array.from(cart.values());
    if (items.some(it => isPriceMissing(it.precio_unitario))) {
      toast.error('Hay productos sin precio configurado.');
      return;
    }
    onConfirm(items);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Agregar productos
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto o marca"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            maxLength={80}
            autoFocus
          />
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 space-y-1">
              <p className="text-sm text-muted-foreground">
                {rows.length === 0
                  ? 'No hay productos activos en esta sucursal.'
                  : 'Sin resultados.'}
              </p>
              {rows.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Activá productos desde Mi Negocio &gt; Catálogo &gt; Productos.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 py-1">
              {filtered.map(row => {
                const item = cart.get(row.sucursal.id);
                const qty = item?.cantidad || 0;
                const stockAfter = Number(row.sucursal.stock_actual) - qty;
                const isLowStock = stockAfter < 0;
                const blocked = isPriceMissing(Number(row.sucursal.precio_venta));
                return (
                  <div
                    key={row.sucursal.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors ${
                      qty > 0 ? 'border-secondary/50 bg-secondary/5' : 'border-border'
                    } ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {row.marca && (
                      <div
                        className="w-1.5 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: row.marca.color }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground truncate">{row.producto.nombre}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {row.marca && <span>{row.marca.nombre}</span>}
                        {row.marca && <span>·</span>}
                        <span>Stock: {Number(row.sucursal.stock_actual).toLocaleString('es-AR')}</span>
                        {qty > 0 && (
                          <span className={isLowStock ? 'text-destructive font-medium' : ''}>
                            → {stockAfter.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                      {!blocked && qty > 0 && canEditPrice && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Precio:</span>
                          <CurrencyInput
                            value={String(item!.precio_unitario)}
                            onChange={(v) => updatePrice(row.sucursal.id, v)}
                            className="h-7 w-28 text-xs"
                            placeholder="0"
                          />
                        </div>
                      )}
                      {!blocked && qty > 0 && !canEditPrice && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Precio: ${item!.precio_unitario.toLocaleString('es-AR')}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {blocked ? (
                        <Badge variant="outline" className="text-xs">Precio pendiente</Badge>
                      ) : qty === 0 ? (
                        <p className="text-sm font-semibold">${Number(row.sucursal.precio_venta).toLocaleString('es-AR')}</p>
                      ) : (
                        <p className="text-sm font-semibold">
                          ${(item!.precio_unitario * qty).toLocaleString('es-AR')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQty(row, -1)}
                        disabled={blocked || qty === 0}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-7 text-center text-sm font-medium">{qty}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQty(row, 1)}
                        disabled={blocked}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {Array.from(cart.values()).some(it => it.cantidad > it.stock_actual) && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <span className="text-amber-700 dark:text-amber-300">
              Algunos productos quedarán con stock negativo. Se permite continuar pero recordá reponer.
            </span>
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold text-foreground">${totalCarrito.toLocaleString('es-AR')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleConfirm}>Confirmar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
