import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Extra } from '@/types/barbershop';
import { toast } from 'sonner';
import { DrawerForm } from '@/components/ui/drawer-form';
import { CatalogSectionCard } from '@/components/ui/CatalogSectionCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

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

const extraSchema = (isGlobal: boolean) => z.object({
  name: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(80, 'El nombre no puede superar los 80 caracteres.'),
  price: isGlobal
    ? z.string().optional()
    : z.string().refine((v) => {
        const cleaned = (v || '').trim();
        if (!cleaned) return false;
        const n = parseFloat(cleaned);
        return !Number.isNaN(n) && n >= 0;
      }, 'El precio debe ser un número igual o mayor a 0.'),
});

type ExtraFormValues = z.infer<ReturnType<typeof extraSchema>>;

const emptyValues: ExtraFormValues = { name: '', price: '' };

export function ExtrasConfig({ extras, onAdd, onUpdate, onDelete, mode = 'sucursal' }: ExtrasConfigProps) {
  const isGlobal = mode === 'global';
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Extra | null>(null);

  const form = useForm<ExtraFormValues>({
    resolver: zodResolver(extraSchema(isGlobal)),
    defaultValues: emptyValues,
  });

  const flagFor = (e: Extra) => isGlobal ? (e.globalActive ?? e.active) : e.active;
  const activeExtras = extras.filter(e => flagFor(e));
  const inactiveExtras = extras.filter(e => !flagFor(e));
  const editingExtra = editingId ? (extras.find(e => e.id === editingId) ?? null) : null;
  const editingIsActive = editingExtra ? flagFor(editingExtra) : false;

  const startAdd = () => {
    form.reset(emptyValues);
    setIsAdding(true);
  };

  const closeDrawer = () => {
    setIsAdding(false);
    setEditingId(null);
    form.reset(emptyValues);
  };

  const onSubmit = async (values: ExtraFormValues) => {
    if (isAdding) {
      await onAdd({ name: values.name.trim(), price: isGlobal ? 0 : parseFloat(values.price!), active: true });
    } else if (editingExtra) {
      const updates: Partial<Extra> = { name: values.name.trim() };
      if (!isGlobal) updates.price = parseFloat(values.price!);
      await onUpdate(editingExtra.id, updates);
    }
    closeDrawer();
  };

  const startEdit = (extra: Extra) => {
    setEditingId(extra.id);
    // CurrencyInput espera string "1234.5" en formato clean (punto decimal).
    form.reset({ name: extra.name, price: extra.price ? String(extra.price) : '' });
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
    <div key={extra.id} className="animate-item-in">
      <div className="rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
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
    </div>
    );
  };

  return (
    <>
      <CatalogSectionCard
        icon={Plus}
        title={isGlobal ? 'Complementos de cobro' : 'Extras de esta sucursal'}
        description={
          isGlobal
            ? 'Ítems opcionales que se suman al cobro. Los precios se configuran en cada sucursal.'
            : 'Activá los extras disponibles y configurá el precio.'
        }
        actions={
          !isAdding && !editingId && activeSubTab === 'active' ? (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={startAdd}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          ) : undefined
        }
        tabs={
          <SegmentedControl
            options={[
              { value: 'active', label: 'Activos', count: activeExtras.length },
              { value: 'inactive', label: 'Inactivos', count: inactiveExtras.length },
            ]}
            value={activeSubTab}
            onChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}
          />
        }
      >
        {isGlobal && (
          <p className="text-xs text-muted-foreground">
            Los precios de los extras se configuran por sucursal.
          </p>
        )}
        {activeSubTab === 'active' && (
          <div className="space-y-2" role="tabpanel">
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
                <Button variant="outline" size="sm" onClick={startAdd}>
                  Agregar extra
                </Button>
              </div>
            )}
          </div>
        )}
        {activeSubTab === 'inactive' && (
          <div className="space-y-2" role="tabpanel">
            {inactiveExtras.map(renderExtraItem)}
            {inactiveExtras.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay extras inactivos</p>
            )}
          </div>
        )}
      </CatalogSectionCard>

      <DrawerForm
        open={isAdding || editingId !== null}
        onOpenChange={(o) => { if (!o) closeDrawer(); }}
        title={isAdding ? 'Agregar extra' : 'Editar extra'}
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
          ) : editingExtra ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <div className="w-px h-5 bg-border" />
              {editingIsActive ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setToggleConfirm({ extra: editingExtra, action: 'deactivate' });
                    closeDrawer();
                  }}
                  className="bg-status-warning text-white hover:bg-status-warning/90"
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
                      closeDrawer();
                    }}
                    className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                  >
                    Activar
                  </Button>
                  {onDelete && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setDeleteConfirm(editingExtra);
                        closeDrawer();
                      }}
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
        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={80} placeholder="Ej: Barba" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isGlobal && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value ?? ''} onChange={field.onChange} placeholder="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </Form>
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
            <AlertDialogAction
              onClick={handleConfirmToggle}
              className={toggleConfirm?.action === 'deactivate' ? 'bg-status-warning text-white hover:bg-status-warning/90' : undefined}
            >
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
