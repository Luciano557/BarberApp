import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit2, Power, PowerOff, Tag } from 'lucide-react';
import { DrawerForm } from '@/components/ui/drawer-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Marca, MARCA_COLORS } from './types';
import { cn } from '@/lib/utils';
import { EntityColorBar } from '@/components/ui/EntityColorBar';

interface Props {
  open: boolean;
  marcas: Marca[];
  onClose: () => void;
  onChanged: () => void;
}

const marcaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(80, 'El nombre no puede superar los 80 caracteres.'),
  color: z.string(),
});

type MarcaFormValues = z.infer<typeof marcaSchema>;

const emptyValues: MarcaFormValues = { nombre: '', color: MARCA_COLORS[0].value };

export function MarcasManagerDialog({ open, marcas, onClose, onChanged }: Props) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<{ marca: Marca; next: boolean } | null>(null);

  const form = useForm<MarcaFormValues>({
    resolver: zodResolver(marcaSchema),
    defaultValues: emptyValues,
  });

  const active = marcas.filter(m => m.activo);
  const inactive = marcas.filter(m => !m.activo);

  const reset = () => {
    setIsAdding(false);
    setEditingId(null);
    form.reset(emptyValues);
  };

  const handleStartAdd = () => {
    setEditingId(null);
    form.reset(emptyValues);
    setIsAdding(true);
  };

  const handleStartEdit = (m: Marca) => {
    setIsAdding(false);
    setEditingId(m.id);
    form.reset({ nombre: m.nombre, color: m.color });
  };

  const onSubmit = async (values: MarcaFormValues) => {
    if (!orgId) return;
    try {
      const nombre = values.nombre.replace(/\s+/g, ' ').trim();
      if (editingId) {
        const { error } = await supabase
          .from('marcas_producto')
          .update({ nombre, color: values.color })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Marca actualizada');
      } else {
        const { error } = await supabase
          .from('marcas_producto')
          .insert({ organization_id: orgId, nombre, color: values.color, activo: true });
        if (error) throw error;
        toast.success('Marca creada');
      }
      reset();
      onChanged();
    } catch (e: any) {
      const msg = e?.message?.includes('duplicate key') ? 'Ya existe una marca con ese nombre' : (e?.message || 'Error al guardar');
      toast.error(msg);
    }
  };

  const handleToggle = async () => {
    if (!toggleConfirm) return;
    const { error } = await supabase
      .from('marcas_producto')
      .update({ activo: toggleConfirm.next })
      .eq('id', toggleConfirm.marca.id);
    if (error) {
      toast.error('No se pudo actualizar');
    } else {
      toast.success(toggleConfirm.next ? 'Marca activada' : 'Marca desactivada');
      onChanged();
    }
    setToggleConfirm(null);
  };

  const nombreValue = form.watch('nombre');
  const colorValue = form.watch('color');

  const renderEditor = () => (
    <Form {...form}>
      <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-3 animate-scale-in">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Nombre de la marca" {...field} maxLength={80} autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          <p className="text-xs text-muted-foreground mb-2">Color</p>
          <div className="flex flex-wrap gap-2">
            {MARCA_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => form.setValue('color', c.value)}
                title={c.name}
                className={cn(
                  'w-7 h-7 rounded-full border-2 transition-all',
                  colorValue === c.value ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: c.value }}
                aria-label={c.name}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-between">
          <Button variant="ghost" size="sm" onClick={reset}>
            Cancelar
          </Button>
          <Button size="sm" onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting || !nombreValue?.trim()}>
            {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Form>
  );

  const renderItem = (m: Marca) => (
    <div key={m.id}>
      {editingId === m.id ? (
        renderEditor()
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
          <EntityColorBar color={m.color} />
          <div className="flex flex-1 items-center gap-3">
            <span className="flex-1 font-medium text-foreground truncate">{m.nombre}</span>
            <Button size="icon" variant="ghost" onClick={() => handleStartEdit(m)} className="h-8 w-8">
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setToggleConfirm({ marca: m, next: !m.activo })}
              className="h-8 w-8"
              title={m.activo ? 'Desactivar' : 'Activar'}
            >
              {m.activo
                ? <PowerOff className="h-4 w-4 text-destructive" />
                : <Power className="h-4 w-4 text-success" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <DrawerForm
        open={open}
        onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}
        title="Marcas"
        size="sm"
        isDirty={(isAdding || !!editingId) && form.formState.isDirty}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Las marcas son globales para toda la organización. El color ayuda a identificarlas en el catálogo.
          </p>

          <div className="flex justify-end">
            {!isAdding && !editingId && tab === 'active' && (
              <Button size="sm" variant="outline" onClick={handleStartAdd}>
                <Plus className="h-4 w-4 mr-1" /> Nueva marca
              </Button>
            )}
          </div>

          <SegmentedControl
            ariaLabel="Estado de marcas"
            options={[
              { value: 'active', label: 'Activas', count: active.length },
              { value: 'inactive', label: 'Inactivas', count: inactive.length },
            ]}
            value={tab}
            onChange={(v) => setTab(v as 'active' | 'inactive')}
          />

          {tab === 'active' ? (
            <div role="tabpanel" aria-label="Marcas activas" className="mt-3 space-y-2">
              {isAdding && renderEditor()}
              {active.map(renderItem)}
              {active.length === 0 && !isAdding && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No hay marcas. Agregá la primera para empezar.
                </p>
              )}
            </div>
          ) : (
            <div role="tabpanel" aria-label="Marcas inactivas" className="mt-3 space-y-2">
              {inactive.map(renderItem)}
              {inactive.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No hay marcas inactivas.
                </p>
              )}
            </div>
          )}
        </div>
      </DrawerForm>

      <AlertDialog open={!!toggleConfirm} onOpenChange={(o) => !o && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.next ? 'Activar marca' : 'Desactivar marca'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.next
                ? `¿Querés volver a activar "${toggleConfirm?.marca.nombre}"?`
                : `¿Desactivar "${toggleConfirm?.marca.nombre}"? Los productos asociados seguirán existiendo, pero no la verás al asignar marca a productos nuevos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle}>
              {toggleConfirm?.next ? 'Activar' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
