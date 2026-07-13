import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { DrawerForm } from '@/components/ui/drawer-form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  barberId: string;
  organizationId: string;
  sucursalId: string;
  forceShow?: boolean;
}

interface CfgRow {
  id: string;
  porcentaje: number;
  activa: boolean;
}

const pctSchema = z.object({
  porcentaje: z.string().refine((v) => {
    const n = parseFloat(v.replace(',', '.'));
    return !Number.isNaN(n) && n > 0 && n <= 100;
  }, 'Ingresá un porcentaje entre 0,01 y 100.'),
});

type PctFormValues = z.infer<typeof pctSchema>;

export function ComisionProductosConfig({ barberId, organizationId, sucursalId, forceShow }: Props) {
  const [config, setConfig] = useState<CfgRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const form = useForm<PctFormValues>({
    resolver: zodResolver(pctSchema),
    defaultValues: { porcentaje: '' },
  });

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('comision_productos_config')
        .select('id, porcentaje, activa')
        .eq('barbero_id', barberId)
        .eq('organization_id', organizationId)
        .eq('activa', true)
        .maybeSingle();
      setConfig(data as CfgRow | null);
    } catch (e) {
      console.error('Error loading comision_productos_config:', e);
    } finally {
      setIsLoading(false);
    }
  }, [barberId, organizationId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  if (isLoading) return null;
  if (!config && !forceShow && !isEditing) return null;

  const openEditor = () => {
    form.reset({ porcentaje: config ? String(config.porcentaje) : '' });
    setIsEditing(true);
  };

  const onSubmit = async (values: PctFormValues) => {
    const num = parseFloat(values.porcentaje.replace(',', '.'));
    try {
      if (config) {
        const ayer = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
        await supabase
          .from('comision_productos_config')
          .update({ activa: false, fecha_fin: ayer })
          .eq('id', config.id);
      }
      const { error } = await supabase
        .from('comision_productos_config')
        .insert({
          organization_id: organizationId,
          sucursal_id: sucursalId,
          barbero_id: barberId,
          porcentaje: num,
          activa: true,
          fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
        });
      if (error) throw error;
      toast.success('Comisión por productos configurada');
      setIsEditing(false);
      fetchConfig();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al guardar');
    }
  };

  const handleDelete = async () => {
    if (!config) return;
    try {
      const hoy = format(new Date(), 'yyyy-MM-dd');
      await supabase
        .from('comision_productos_config')
        .update({ activa: false, fecha_fin: hoy })
        .eq('id', config.id);
      toast.success('Extra eliminado');
      setConfig(null);
      setShowDelete(false);
    } catch (e: any) {
      toast.error('Error al eliminar');
    }
  };

  const editorDrawer = (
    <DrawerForm
      open={isEditing}
      onOpenChange={(o) => { if (!o) setIsEditing(false); }}
      title="Comisión por productos vendidos"
      size="sm"
      isDirty={form.formState.isDirty}
      footer={
        <div className="flex gap-2 w-full">
          <Button size="sm" className="flex-1" disabled={form.formState.isSubmitting} onClick={form.handleSubmit(onSubmit)}>
            {form.formState.isSubmitting ? 'Guardando...' : config ? 'Actualizar' : 'Guardar'}
          </Button>
          <Button variant="outline" size="sm" disabled={form.formState.isSubmitting} onClick={() => setIsEditing(false)}>
            Cancelar
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <FormField
          control={form.control}
          name="porcentaje"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Porcentaje sobre la ganancia (%)</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  className="h-8 text-sm"
                  placeholder="0"
                  maxLength={6}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value.replace(/[^\d.,]/g, ''))}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                La comisión se calcula sobre la ganancia (precio de venta − precio de costo) de cada producto vendido por este barbero.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </DrawerForm>
  );

  // Sin configuración: botón para configurar
  if (!config) {
    return (
      <>
        <div className="mt-2 p-3 rounded-md border border-dashed border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Comisión por productos vendidos</span>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openEditor}>
              Configurar
            </Button>
          </div>
        </div>
        {editorDrawer}
      </>
    );
  }

  // Mostrar configuración activa
  return (
    <div className="mt-2 p-3 rounded-md border border-border bg-muted/20 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Comisión por productos vendidos</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => setShowDelete(true)}
          aria-label="Eliminar extra"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Porcentaje sobre la ganancia</span>
        <span className="font-medium">{config.porcentaje}%</span>
      </div>
      <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={openEditor}>
        Editar porcentaje
      </Button>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar comisión por productos</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactiva el extra a partir de hoy. No se modifican cierres ni pagos históricos. Podés volver a configurarlo más adelante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editorDrawer}
    </div>
  );
}
