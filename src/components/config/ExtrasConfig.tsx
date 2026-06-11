import { useState } from 'react';
import { Plus, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Extra } from '@/types/barbershop';
import { toast } from 'sonner';
import { DrawerForm } from '@/components/ui/drawer-form';
import { TabBadge } from '@/components/ui/TabBadge';

interface ExtrasConfigProps {
  extras: Extra[];
  onAdd: (extra: Omit<Extra, 'id' | 'uid'>) => void;
  onUpdate: (id: string, updates: Partial<Extra>) => void;
  /** Opcional: si se provee, habilita botón "Eliminar" para extras inactivos. */
  onDelete?: (id: string) => void;
  /**
   * 'global' = edita catálogo global (sin precio); usa globalActive para Activos/Inactivos.
   * 'sucursal' (default) = comportamiento histórico por sucursal.
   */
  mode?: 'global' | 'sucursal';
}

interface ToggleConfirm {
  extra: Extra;
  action: 'activate' | 'deactivate';
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'El nombre no puede estar vacío.';
  if (trimmed.length > 80) return 'El nombre no puede superar los 80 caracteres.';
  return null;
}

function validatePrice(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = (raw || '').toString().trim();
  if (!cleaned) return { ok: false, error: 'El precio debe ser un número igual o mayor a 0.' };
  const value = parseFloat(cleaned);
  if (Number.isNaN(value) || value < 0) {
    return { ok: false, error: 'El precio debe ser un número igual o mayor a 0.' };
  }
  return { ok: true, value };
}

export function ExtrasConfig({ extras, onAdd, onUpdate, onDelete, mode = 'sucursal' }: ExtrasConfigProps) {
  const isGlobal = mode === 'global';
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Extra | null>(null);

  const flagFor = (e: Extra) => isGlobal ? (e.globalActive ?? e.active) : e.active;
  const activeExtras = extras.filter(e => flagFor(e));
  const inactiveExtras = extras.filter(e => !flagFor(e));
  const editingExtra = editingId ? (extras.find(e => e.id === editingId) ?? null) : null;
  const editingIsActive = editingExtra ? flagFor(editingExtra) : false;

  const handleAdd = () => {
    const nameErr = validateName(newName);
    if (nameErr) { toast.error(nameErr); return; }
    let price = 0;
    if (!isGlobal) {
      const v = validatePrice(newPrice);
      if (v.ok === false) { toast.error(v.error); return; }
      price = v.value;
    }
    onAdd({ name: newName.trim(), price, active: true });
    setNewName(''); setNewPrice(''); setIsAdding(false);
  };

  const handleUpdate = (id: string) => {
    const nameErr = validateName(newName);
    if (nameErr) { toast.error(nameErr); return; }
    const updates: Partial<Extra> = { name: newName.trim() };
    if (!isGlobal) {
      const v = validatePrice(newPrice);
      if (v.ok === false) { toast.error(v.error); return; }
      updates.price = v.value;
    }
    onUpdate(id, updates);
    setEditingId(null); setNewName(''); setNewPrice('');
  };

  const startEdit = (extra: Extra) => {
    setEditingId(extra.id);
    setNewName(extra.name);
    // CurrencyInput espera string "1234.5" en formato clean (punto decimal).
    setNewPrice(extra.price ? String(extra.price) : '');
  };

  const handleConfirmToggle = () => {
    if (!toggleConfirm) return;
    onUpdate(toggleConfirm.extra.id, { active: toggleConfirm.action === 'activate' });
    setToggleConfirm(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm || !onDelete) return;
    onDelete(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const isItemActive = (extra: Extra) =>
    isGlobal ? (extra.globalActive ?? extra.active) : extra.active;

  const renderExtraItem = (extra: Extra) => {
    const itemActive = isItemActive(extra);
    return (
    <div key={extra.id} className="rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <span className="min-w-0 flex-1 break-words font-medium text-foreground sm:truncate">{extra.name}</span>
        {!isGlobal && (
          <span className="text-muted-foreground tabular-nums">${extra.price.toLocaleString('es-AR')}</span>
        )}
        <div className="flex items-center justify-end">
          <button
            onClick={() => startEdit(extra)}
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
      <Card className="border border-border bg-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {isGlobal ? 'Complementos de cobro' : 'Extras de esta sucursal'}
                </CardTitle>
                <CardDescription>
                  {isGlobal
                    ? 'Ítems opcionales que se suman al cobro. Los precios se configuran en cada sucursal.'
                    : 'Activá los extras disponibles y configurá el precio.'}
                </CardDescription>
              </div>
            </div>
            {!isAdding && !editingId && activeSubTab === 'active' && (
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4 mr-1" /> Agregar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGlobal && (
            <p className="text-xs text-muted-foreground">
              Los precios de los extras se configuran por sucursal.
            </p>
          )}
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-md bg-muted/50 p-1">
              <TabsTrigger value="active" className="group min-h-8 whitespace-normal px-2 text-xs data-[state=active]:bg-card">Activos<TabBadge count={activeExtras.length} /></TabsTrigger>
              <TabsTrigger value="inactive" className="group min-h-8 whitespace-normal px-2 text-xs data-[state=active]:bg-card">Inactivos<TabBadge count={inactiveExtras.length} /></TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4 space-y-2">
              {activeExtras.map(renderExtraItem)}
              {activeExtras.length === 0 && !isAdding && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
                  <Plus className="h-8 w-8 text-muted-foreground/50" />
                  <div>
                    <p className="text-sm font-medium">No hay extras activos</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Agregá extras para cobrarlos junto a un servicio.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
                    Agregar extra
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="inactive" className="mt-4 space-y-2">
              {inactiveExtras.map(renderExtraItem)}
              {inactiveExtras.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay extras inactivos</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <DrawerForm
        open={isAdding || editingId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setIsAdding(false);
            setEditingId(null);
            setNewName('');
            setNewPrice('');
          }
        }}
        title={isAdding ? 'Agregar extra' : 'Editar extra'}
        size="sm"
        footer={
          isAdding ? (
            <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={() => { setIsAdding(false); setNewName(''); setNewPrice(''); }}>Cancelar</Button>
              <Button onClick={handleAdd}>Guardar</Button>
            </div>
          ) : editingExtra ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button onClick={() => handleUpdate(editingExtra.id)}>
                Guardar cambios
              </Button>
              <div className="w-px h-5 bg-border" />
              {editingIsActive ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setToggleConfirm({ extra: editingExtra, action: 'deactivate' });
                    setEditingId(null); setNewName(''); setNewPrice('');
                  }}
                  className="bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
                >
                  Desactivar
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      onUpdate(editingExtra.id, { active: true });
                      toast.success('Extra activado');
                      setEditingId(null); setNewName(''); setNewPrice('');
                    }}
                    className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                  >
                    Activar
                  </Button>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDeleteConfirm(editingExtra);
                        setEditingId(null); setNewName(''); setNewPrice('');
                      }}
                      className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
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
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} placeholder="Ej: Barba" />
          </div>
          {!isGlobal && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Precio</label>
              <CurrencyInput value={newPrice} onChange={setNewPrice} placeholder="0" />
            </div>
          )}
        </div>
      </DrawerForm>

      {/* Toggle confirmation dialog */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => !open && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar extra' : 'Activar extra'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.action === 'deactivate'
                ? `¿Estás seguro de que querés desactivar "${toggleConfirm?.extra.name}"?`
                : `¿Querés volver a activar "${toggleConfirm?.extra.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmToggle}>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar extra</AlertDialogTitle>
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
    </>
  );
}
