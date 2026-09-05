import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Tag, Search, Package } from 'lucide-react';
import { useShowMore } from '@/hooks/useShowMore';
import { ShowMoreDivider } from '@/components/ui/ShowMoreDivider';
import { Button } from '@/components/ui/button';
import { CatalogSectionCard } from '@/components/ui/CatalogSectionCard';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Marca, Producto, ProductoSucursal, ProductoConSucursal } from './types';
import { ProductoListItem } from './ProductoListItem';
import { ProductoDialog } from './ProductoDialog';
import { MarcasManagerDialog } from './MarcasManagerDialog';
import { StockMovementDialog } from './StockMovementDialog';
import { StockHistoryDialog } from './StockHistoryDialog';

interface ProductosConfigProps {
  sucursalId: string;
}

export function ProductosConfig({ sucursalId }: ProductosConfigProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosSucursal, setProductosSucursal] = useState<ProductoSucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedVisible(loading);

  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [search, setSearch] = useState('');

  const [productoDialog, setProductoDialog] = useState<{ open: boolean; producto: ProductoConSucursal | null }>({ open: false, producto: null });
  const [marcasDialog, setMarcasDialog] = useState(false);
  const [stockDialog, setStockDialog] = useState<{
    open: boolean;
    producto: ProductoConSucursal | null;
    tipo: 'stock_inicial' | 'reposicion' | 'ajuste_manual';
  }>({ open: false, producto: null, tipo: 'reposicion' });
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; producto: ProductoConSucursal | null }>({ open: false, producto: null });

  const fetchAll = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [m, p, ps] = await Promise.all([
      supabase.from('marcas_producto').select('*').eq('organization_id', orgId).order('nombre'),
      supabase.from('productos').select('*').eq('organization_id', orgId).order('nombre'),
      supabase.from('productos_sucursal').select('*').eq('organization_id', orgId).eq('sucursal_id', sucursalId),
    ]);
    if (m.error || p.error || ps.error) {
      toast.error('Error al cargar productos');
    } else {
      setMarcas((m.data || []) as Marca[]);
      setProductos((p.data || []) as Producto[]);
      setProductosSucursal((ps.data || []) as ProductoSucursal[]);
    }
    setLoading(false);
  }, [orgId, sucursalId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Combinar productos globales con su config de sucursal
  const items: ProductoConSucursal[] = useMemo(() => {
    const psMap = new Map(productosSucursal.map(x => [x.producto_id, x]));
    const marcasMap = new Map(marcas.map(x => [x.id, x]));
    return productos
      .filter(p => p.activo)
      .map(p => ({
        producto: p,
        marca: p.marca_id ? marcasMap.get(p.marca_id) || null : null,
        sucursal: psMap.get(p.id) || null,
      }));
  }, [productos, productosSucursal, marcas]);

  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter(it => {
      const isActiveInSucursal = it.sucursal?.activo === true;
      if (activeSubTab === 'active' && !isActiveInSucursal) return false;
      if (activeSubTab === 'inactive' && isActiveInSucursal) return false;
      if (!s) return true;
      return (
        it.producto.nombre.toLowerCase().includes(s) ||
        (it.marca?.nombre.toLowerCase().includes(s) ?? false)
      );
    });
  }, [items, activeSubTab, search]);

  const activeCount = items.filter(it => it.sucursal?.activo === true).length;
  const inactiveCount = items.length - activeCount;

  const isDefaultView = activeSubTab === 'active' && search.trim() === '';
  const { visible, expanded, toggle, showDivider, hiddenCount, threshold } =
    useShowMore(filteredItems, { isDefaultView });

  const handleDeleteProductoSucursal = async (item: ProductoConSucursal) => {
    if (!item.sucursal) return;
    const { error } = await supabase
      .from('productos_sucursal')
      .delete()
      .eq('id', item.sucursal.id);
    if (error) { toast.error('No se pudo eliminar la configuración'); return; }
    toast.success('Configuración de sucursal eliminada');
    await fetchAll();
  };

  const handleToggleActiveSucursal = async (item: ProductoConSucursal, nextActive: boolean) => {
    if (!orgId) return;
    if (item.sucursal) {
      const { error } = await supabase
        .from('productos_sucursal')
        .update({ activo: nextActive })
        .eq('id', item.sucursal.id);
      if (error) { toast.error('No se pudo actualizar'); return; }
      toast.success(nextActive ? 'Producto activado en sucursal' : 'Producto desactivado en sucursal');
      await fetchAll();
    } else {
      // Crear vínculo con valores por defecto
      const { error } = await supabase
        .from('productos_sucursal')
        .insert({
          organization_id: orgId,
          sucursal_id: sucursalId,
          producto_id: item.producto.id,
          activo: nextActive,
          precio_venta: 0,
          stock_actual: 0,
        });
      if (error) { toast.error('No se pudo activar'); return; }
      toast.success('Producto activado en sucursal. Configurá precios y stock.');
      await fetchAll();
    }
  };

  return (
    <>
      <CatalogSectionCard
        icon={Package}
        title="Productos de esta sucursal"
        description="Activá productos, configurá precios, costos y gestioná el stock."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setMarcasDialog(true)}>
              <Tag className="h-4 w-4 mr-1" /> Marcas
            </Button>
            <Button size="sm" className="w-full sm:w-auto" onClick={() => setProductoDialog({ open: true, producto: null })}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo producto
            </Button>
          </div>
        }
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o marca"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              maxLength={80}
            />
          </div>
        }
        tabs={
          <SegmentedControl
            options={[
              { value: 'active', label: 'Activos', count: activeCount },
              { value: 'inactive', label: 'Inactivos', count: inactiveCount },
            ]}
            value={activeSubTab}
            onChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}
          />
        }
      >
        <div className="space-y-2" role="tabpanel">
          {loading ? (
            showSkeleton ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30">
                    <SkeletonRow leading="bar" />
                  </div>
                ))}
              </div>
            ) : null
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                {productos.length === 0
                  ? 'Todavía no hay productos. Creá el primero para empezar.'
                  : activeSubTab === 'active'
                    ? 'No hay productos activos en esta sucursal.'
                    : 'No hay productos inactivos.'}
              </p>
            </div>
          ) : (
            <>
              {visible.map((item, idx) => {
                const row = (
                  <ProductoListItem
                    key={item.producto.id}
                    item={item}
                    onEdit={() => setProductoDialog({ open: true, producto: item })}
                    onToggleActive={(next) => handleToggleActiveSucursal(item, next)}
                    onStockInicial={() => setStockDialog({ open: true, producto: item, tipo: 'stock_inicial' })}
                    onAgregarStock={() => setStockDialog({ open: true, producto: item, tipo: 'reposicion' })}
                    onAjustarStock={() => setStockDialog({ open: true, producto: item, tipo: 'ajuste_manual' })}
                    onVerHistorial={() => setHistoryDialog({ open: true, producto: item })}
                    onDelete={() => handleDeleteProductoSucursal(item)}
                  />
                );
                if (expanded && idx >= threshold) {
                  return <div key={`sm-${item.producto.id}`} className="animate-item-in">{row}</div>;
                }
                return row;
              })}
              {showDivider && (
                <ShowMoreDivider count={hiddenCount} onClick={toggle} expanded={expanded} label="productos más" />
              )}
            </>
          )}
        </div>
      </CatalogSectionCard>

      <ProductoDialog
        open={productoDialog.open}
        producto={productoDialog.producto}
        marcas={marcas}
        sucursalId={sucursalId}
        onClose={() => setProductoDialog({ open: false, producto: null })}
        onSaved={fetchAll}
        onManageMarcas={() => setMarcasDialog(true)}
      />

      <MarcasManagerDialog
        open={marcasDialog}
        marcas={marcas}
        onClose={() => setMarcasDialog(false)}
        onChanged={fetchAll}
      />

      {stockDialog.producto && (
        <StockMovementDialog
          open={stockDialog.open}
          item={stockDialog.producto}
          tipo={stockDialog.tipo}
          onClose={() => setStockDialog({ open: false, producto: null, tipo: 'reposicion' })}
          onSaved={fetchAll}
        />
      )}

      {historyDialog.producto && (
        <StockHistoryDialog
          open={historyDialog.open}
          item={historyDialog.producto}
          onClose={() => setHistoryDialog({ open: false, producto: null })}
        />
      )}
    </>
  );
}
