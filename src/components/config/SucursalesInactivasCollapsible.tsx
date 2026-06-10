import { useState } from 'react';
import { MapPin, Trash2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Sucursal } from '@/contexts/SucursalContext';
import { toast } from 'sonner';
import { ShowMoreDivider } from '@/components/ui/ShowMoreDivider';

interface Props {
  sucursalesInactivas: Array<Sucursal & { fecha_desactivacion?: string | null }>;
  onVerSucursal: (sucursalId: string) => void;
  onAfterDelete: () => Promise<void> | void;
}

function formatFechaDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function SucursalesInactivasCollapsible({ sucursalesInactivas, onVerSucursal, onAfterDelete }: Props) {
  const { isOwner, isGeneralManager } = useAuth();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<{
    suc: Sucursal;
    checking: boolean;
    hasHistory: boolean | null;
    submitting: boolean;
  } | null>(null);

  if (!isOwner && !isGeneralManager) return null;
  if (!sucursalesInactivas || sucursalesInactivas.length === 0) return null;

  const handleEliminarClick = async (suc: Sucursal) => {
    setTarget({ suc, checking: true, hasHistory: null, submitting: false });
    const { data, error } = await supabase.rpc('sucursal_tiene_historial', { _sucursal_id: suc.id });
    if (error) {
      toast.error('No se pudo verificar el historial de la sucursal');
      setTarget(null);
      return;
    }
    setTarget(prev => prev && prev.suc.id === suc.id
      ? { ...prev, checking: false, hasHistory: !!data }
      : prev);
  };

  const handleConfirm = async () => {
    if (!target) return;
    setTarget(prev => prev ? { ...prev, submitting: true } : prev);
    try {
      const { data, error } = await supabase.functions.invoke('soft-delete-sucursal', {
        body: { sucursalId: target.suc.id },
      });
      if (error) throw new Error(error.message || 'Error al eliminar la sucursal');
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Sucursal eliminada');
      await onAfterDelete();
      setTarget(null);
    } catch (e: any) {
      toast.error(e?.message || 'Error al eliminar la sucursal');
      setTarget(prev => prev ? { ...prev, submitting: false } : prev);
    }
  };

  const dialogOpen = !!target && target.hasHistory !== null;

  return (
    <div className="mt-8">
      <Collapsible open={open} onOpenChange={setOpen}>
        <ShowMoreDivider
          count={sucursalesInactivas.length}
          label="sucursales desactivadas"
          onClick={() => setOpen(!open)}
          expanded={open}
        />
        <CollapsibleContent className="pt-3 space-y-2">
          {sucursalesInactivas.map((suc) => (
            <Card key={suc.id} className="opacity-80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{suc.nombre}</p>
                      {suc.direccion && (
                        <p className="text-sm text-muted-foreground truncate">{suc.direccion}</p>
                      )}
                      {suc.fecha_desactivacion && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Desactivada el {formatFechaDDMMYYYY(suc.fecha_desactivacion)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => onVerSucursal(suc.id)}>
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      Ver
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleEliminarClick(suc)}
                      disabled={target?.suc.id === suc.id && (target.checking || target.submitting)}
                    >
                      {target?.suc.id === suc.id && target.checking ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Eliminar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(o) => { if (!o && !target?.submitting) setTarget(null); }}
      >
        <AlertDialogContent>
          {target && target.hasHistory !== null && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar sucursal</AlertDialogTitle>
                <AlertDialogDescription>
                  {target.hasHistory
                    ? 'Esta sucursal tiene historial registrado. Al eliminarla, quedará archivada de forma permanente y no podrás volver a usarla ni recuperarla desde la app. Esta acción no tiene vuelta atrás.'
                    : 'Esta sucursal no tiene registros. Se eliminará de tu negocio.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={target.submitting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); handleConfirm(); }}
                  disabled={target.submitting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {target.submitting
                    ? 'Procesando…'
                    : target.hasHistory ? 'Archivar permanentemente' : 'Eliminar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
