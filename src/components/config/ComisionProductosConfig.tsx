import { useState, useEffect, useCallback } from 'react';
import { Package, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function ComisionProductosConfig({ barberId, organizationId, sucursalId, forceShow }: Props) {
  const [config, setConfig] = useState<CfgRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [pct, setPct] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

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

  const handleSave = async () => {
    const num = parseFloat(pct.replace(',', '.'));
    if (isNaN(num) || num <= 0 || num > 100) {
      toast.error('Ingresá un porcentaje entre 0,01 y 100');
      return;
    }
    setIsSaving(true);
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
      setPct('');
      fetchConfig();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
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

  // Sin configuración: botón para configurar
  if (!config && !isEditing) {
    return (
      <div className="mt-2 p-3 rounded-md border border-dashed border-border bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Comisión por productos vendidos</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setPct(''); setIsEditing(true); }}>
            Configurar
          </Button>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="mt-2 p-3 rounded-md border border-border bg-muted/20 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Comisión por productos vendidos</span>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Porcentaje sobre la ganancia (%)</Label>
          <Input
            inputMode="decimal"
            className="h-8 text-sm"
            placeholder="0"
            value={pct}
            onChange={(e) => setPct(e.target.value.replace(/[^\d.,]/g, ''))}
            maxLength={6}
          />
          <p className="text-xs text-muted-foreground">
            La comisión se calcula sobre la ganancia (precio de venta − precio de costo) de cada producto vendido por este barbero.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs flex-1" disabled={isSaving} onClick={handleSave}>
            {isSaving ? 'Guardando...' : config ? 'Actualizar' : 'Guardar'}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsEditing(false)}>
            Cancelar
          </Button>
        </div>
      </div>
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
        <span className="font-medium">{config!.porcentaje}%</span>
      </div>
      <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => { setPct(String(config!.porcentaje)); setIsEditing(true); }}>
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
    </div>
  );
}
