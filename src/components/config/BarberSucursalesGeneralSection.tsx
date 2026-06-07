import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, MapPin, Loader2, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  useBarberosSucursales,
  type BarberoSucursalRow,
} from '@/hooks/useBarberosSucursales';
import { WeekdayPicker, formatDiasSemana } from './WeekdayPicker';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  barberoId: string;
  organizationId: string;
  sucursales: { id: string; nombre: string }[];
  /** Notificar al padre cuando cambia la sucursal principal para refrescar listas. */
  onPrincipalChanged?: () => void | Promise<void>;
}

/**
 * Sección embebida en cada barbero del panel Equipo General.
 * Permite gestionar la sucursal principal (doble escritura legacy + bs)
 * y las asignaciones recurrentes a otras sucursales.
 */
export function BarberSucursalesGeneralSection({
  barberoId, organizationId, sucursales, onPrincipalChanged,
}: Props) {
  const { isOwner, isGeneralManager } = useAuth();
  const canManageRecurrentes = isOwner || isGeneralManager;
  const bs = useBarberosSucursales(organizationId);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BarberoSucursalRow[]>([]);
  const [savingPrincipal, setSavingPrincipal] = useState(false);
  const [recurrenteOpen, setRecurrenteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BarberoSucursalRow | null>(null);

  const fetchRows = useCallback(async () => {
    if (!organizationId || !barberoId) return;
    setLoading(true);
    try {
      const list = await bs.listByBarbero(barberoId);
      setRows(list);
    } catch (e: any) {
      console.error('BarberSucursalesGeneralSection fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [bs, organizationId, barberoId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const principal = rows.find(r => r.tipo === 'principal');
  const recurrentes = rows.filter(r => r.tipo === 'recurrente');

  const handleChangePrincipal = async (newSucursalId: string) => {
    if (!newSucursalId || newSucursalId === principal?.sucursal_id) return;
    setSavingPrincipal(true);
    try {
      await bs.savePrincipalDualWrite(barberoId, newSucursalId);
      toast.success('Sucursal principal actualizada');
      await fetchRows();
      if (onPrincipalChanged) await onPrincipalChanged();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo actualizar la sucursal principal');
    } finally {
      setSavingPrincipal(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await bs.deleteRow(deleteTarget.id);
      toast.success('Asignación recurrente eliminada');
      setDeleteTarget(null);
      await fetchRows();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar');
    }
  };

  const sucursalName = (id: string) => sucursales.find(s => s.id === id)?.nombre || '—';

  return (
    <div className="mt-3 mb-3 p-3 rounded-md bg-background/60 border border-border space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <MapPin className="h-3.5 w-3.5" /> Sucursales
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          {/* Principal */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Sucursal principal</Label>
            <Select
              value={principal?.sucursal_id ?? ''}
              onValueChange={handleChangePrincipal}
              disabled={savingPrincipal}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {sucursales.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recurrentes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-muted-foreground">
                Sucursales secundarias (recurrentes)
              </Label>
              {canManageRecurrentes && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRecurrenteOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                </Button>
              )}
            </div>

            {recurrentes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">Sin asignaciones recurrentes.</p>
            ) : (
              <div className="space-y-1.5">
                {recurrentes.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        <Repeat className="h-3 w-3 mr-1" /> {sucursalName(r.sucursal_id)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {formatDiasSemana(r.dias_semana)}
                        {r.fecha_inicio && ` · desde ${formatShortDate(r.fecha_inicio)}`}
                        {r.fecha_fin && ` · hasta ${formatShortDate(r.fecha_fin)}`}
                      </span>
                    </div>
                    {canManageRecurrentes && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Sheet: agregar recurrente */}
      {canManageRecurrentes && (
        <AgregarRecurrenteSheet
          open={recurrenteOpen}
          onOpenChange={setRecurrenteOpen}
          organizationId={organizationId}
          barberoId={barberoId}
          sucursales={sucursales}
          principalSucursalId={principal?.sucursal_id}
          onCreated={fetchRows}
        />
      )}

      {/* Eliminar recurrente */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar asignación recurrente</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará la asignación recurrente a {deleteTarget ? sucursalName(deleteTarget.sucursal_id) : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

interface AgregarRecurrenteSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  organizationId: string;
  barberoId: string;
  sucursales: { id: string; nombre: string }[];
  principalSucursalId?: string;
  onCreated: () => void | Promise<void>;
}

function AgregarRecurrenteSheet({
  open, onOpenChange, organizationId, barberoId, sucursales, principalSucursalId, onCreated,
}: AgregarRecurrenteSheetProps) {
  const bs = useBarberosSucursales(organizationId);
  const [sucursalId, setSucursalId] = useState('');
  const [dias, setDias] = useState<number[]>([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSucursalId('');
      setDias([]);
      setFechaInicio('');
      setFechaFin('');
    }
  }, [open]);

  const selectable = sucursales.filter(s => s.id !== principalSucursalId);
  const canSave =
    !!sucursalId && dias.length > 0 &&
    (!fechaInicio || !fechaFin || fechaFin >= fechaInicio);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await bs.insertRecurrente({
        barbero_id: barberoId,
        sucursal_id: sucursalId,
        dias_semana: dias,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
      });
      toast.success('Asignación recurrente creada');
      onOpenChange(false);
      await onCreated();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Sucursal secundaria recurrente</SheetTitle>
          <SheetDescription>
            Definí en qué sucursal trabaja este barbero ciertos días de la semana.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Sucursal</Label>
            <Select value={sucursalId} onValueChange={setSucursalId}>
              <SelectTrigger><SelectValue placeholder="Elegí una sucursal" /></SelectTrigger>
              <SelectContent>
                {selectable.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Días de la semana</Label>
            <WeekdayPicker value={dias} onChange={setDias} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Desde (opcional)</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hasta (opcional)</Label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
