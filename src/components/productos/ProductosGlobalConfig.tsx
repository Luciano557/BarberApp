import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Power, PowerOff, Search, Tag, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DrawerForm } from '@/components/ui/drawer-form';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Marca, Producto } from './types';
import { MarcasManagerDialog } from './MarcasManagerDialog';
import { TabBadge } from '@/components/ui/TabBadge';

/**
 * Configuración global del catálogo de productos.
 * Edita SOLO datos globales: nombre, marca, descripción y activo global.
 * No toca productos_sucursal, stock ni precios por sucursal.
 */

interface FormState {
  nombre: string;
  marca_id: string; // '' = sin marca
  descripcion: string;
}

const emptyForm: FormState = { nombre: '', marca_id: '', descripcion: '' };

export function ProductosGlobalConfig() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [marcasDialogOpen, setMarcasDialogOpen] = useState(false);
  const [toggleConfirm, setToggleConfirm] = useState<{ producto: Producto; next: boolean } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [m, p] = await Promise.all([
      supabase.from('marcas_producto').select('*').eq('organization_id', orgId).order('nombre'),
      supabase.from('productos').select('*').eq('organization_id', orgId).order('nombre'),
    ]);
    if (m.error || p.error) {
      toast.error('Error al cargar productos');
    } else {
      setMarcas((m.data || []) as Marca[]);
      setProductos((p.data || []) as Producto[]);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const marcasMap = useMemo(() => new Map(marcas.map(m => [m.id, m])), [marcas]);
  const activeMarcas = useMemo(() => marcas.filter(m => m.activo), [marcas]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return productos.filter(p => {
      if (activeSubTab === 'active' && !p.activo) return false;
      if (activeSubTab === 'inactive' && p.activo) return false;
      if (!s) return true;
      const marca = p.marca_id ? marcasMap.get(p.marca_id)?.nombre || '' : '';
      return p.nombre.toLowerCase().includes(s) || marca.toLowerCase().includes(s);
    });
  }, [productos, marcasMap, search, activeSubTab]);

  const activeCount = productos.filter(p => p.activo).length;
  const inactiveCount = productos.length - activeCount;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (p: Producto) => {
    setEditingId(p.id);
    setForm({
      nombre: p.nombre,
      marca_id: p.marca_id || '',
      descripcion: p.descripcion || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    const nombre = form.nombre.replace(/\s+/g, ' ').trim();
    if (!nombre) {
      toast.error('Ingresá un nombre');
      return;
    }
    setSaving(true);
    const payload = {
      nombre,
      marca_id: form.marca_id || null,
      descripcion: form.descripcion.trim() || null,
    };
    if (editingId) {
      const { error } = await supabase.from('productos').update(payload).eq('id', editingId);
      if (error) {
        toast.error('Error al actualizar producto');
      } else {
        toast.success('Producto actualizado');
        setShowDialog(false);
        await fetchAll();
      }
    } else {
      const { error } = await supabase.from('productos').insert({
        ...payload,
        activo: true,
        organization_id: orgId,
      });
      if (error) {
        toast.error('Error al crear producto');
      } else {
        toast.success('Producto agregado');
        setShowDialog(false);
        await fetchAll();
      }
    }
    setSaving(false);
  };

  const handleConfirmToggle = async () => {
    if (!toggleConfirm) return;
    const { error } = await supabase
      .from('productos')
      .update({ activo: toggleConfirm.next })
      .eq('id', toggleConfirm.producto.id);
    if (error) {
      toast.error('Error al cambiar el estado');
    } else {
      toast.success(toggleConfirm.next ? 'Producto activado' : 'Producto desactivado');
      await fetchAll();
    }
    setToggleConfirm(null);
  };

  return (
    <>
      <Card className="border border-border bg-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Catálogo de productos</CardTitle>
                <CardDescription>Productos para reventa. Los precios y stock se configuran en cada sucursal.</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setMarcasDialogOpen(true)}>
                <Tag className="h-4 w-4 mr-1" /> Marcas
              </Button>
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Agregar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
            <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
              <TabsTrigger value="active" className="group flex-1 text-xs data-[state=active]:bg-card">
                Activos<TabBadge count={activeCount} />
              </TabsTrigger>
              <TabsTrigger value="inactive" className="group flex-1 text-xs data-[state=active]:bg-card">
                Inactivos<TabBadge count={inactiveCount} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeSubTab} className="mt-4 space-y-2">
              {loading && (
                <p className="text-sm text-muted-foreground text-center py-4">Cargando…</p>
              )}
              {!loading && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {activeSubTab === 'active' ? 'No hay productos activos' : 'No hay productos inactivos'}
                </p>
              )}
              {filtered.map(p => {
                const marca = p.marca_id ? marcasMap.get(p.marca_id) : null;
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground truncate">{p.nombre}</span>
                        {marca && (
                          <span
                            className="text-xs px-2 py-0.5 rounded text-primary-foreground"
                            style={{ backgroundColor: marca.color }}
                          >
                            {marca.nombre}
                          </span>
                        )}
                      </div>
                      {p.descripcion && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.descripcion}</p>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)} className="h-8 w-8">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setToggleConfirm({ producto: p, next: !p.activo })}
                      className="h-8 w-8"
                      title={p.activo ? 'Desactivar' : 'Activar'}
                    >
                      {p.activo
                        ? <PowerOff className="h-4 w-4 text-destructive" />
                        : <Power className="h-4 w-4 text-success" />}
                    </Button>
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <DrawerForm
        open={showDialog}
        onOpenChange={(o) => { if (!o) { setShowDialog(false); setEditingId(null); setForm(emptyForm); } }}
        title={editingId ? 'Editar producto' : 'Nuevo producto'}
        size="sm"
        footer={
          <div className="flex w-full justify-between">
            <Button variant="ghost" disabled={saving} onClick={() => { setShowDialog(false); setEditingId(null); setForm(emptyForm); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre.trim()}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Datos generales del producto. El stock y los precios se configuran por sucursal.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre</label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Cera mate 100ml"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Marca</label>
            <div className="flex gap-2">
              <Select
                value={form.marca_id || 'none'}
                onValueChange={(v) => setForm(p => ({ ...p, marca_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder="Sin marca" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin marca</SelectItem>
                  {activeMarcas.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setMarcasDialogOpen(true)} title="Gestionar marcas">
                <Tag className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Descripción</label>
            <Textarea
              value={form.descripcion}
              onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))}
              placeholder="Detalles internos (opcional)"
              rows={3}
              maxLength={240}
            />
            <p className="text-xs text-muted-foreground text-right">{form.descripcion.length}/240</p>
          </div>
        </div>
      </DrawerForm>

      {/* Marcas manager */}
      <MarcasManagerDialog
        open={marcasDialogOpen}
        marcas={marcas}
        onClose={() => setMarcasDialogOpen(false)}
        onChanged={fetchAll}
      />

      {/* Toggle confirm */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={(o) => !o && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.next ? 'Activar producto' : 'Desactivar producto'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.next
                ? `¿Querés activar "${toggleConfirm?.producto.nombre}" en el catálogo global?`
                : `¿Querés desactivar "${toggleConfirm?.producto.nombre}" del catálogo global? Dejará de estar disponible para todas las sucursales.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmToggle}>
              {toggleConfirm?.next ? 'Activar' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
