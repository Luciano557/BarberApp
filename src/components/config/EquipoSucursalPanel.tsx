import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, AlertTriangle, Repeat, Loader2, MapPin, CalendarCheck, UserX, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useBarberosSucursales,
  pickVigenteHoy,
  todayLocalIso,
  type BarberoSucursalRow,
} from '@/hooks/useBarberosSucursales';
import { WeekdayPicker, formatDiasSemana } from './WeekdayPicker';
import { useBarberosSucursalesRealtime } from '@/hooks/useBarberosSucursalesRealtime';

interface Props {
  sucursalId: string;
  sucursalNombre: string;
  organizationId: string;
  /** Id de barbero a resaltar al montar (navegación desde Equipo General). */
  highlightBarberoId?: string;
}

interface BarberoMini {
  id: string;
  nombre: string;
  apellido: string;
  rol_equipo: string | null;
  activo: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  general_manager: 'Encargado General',
  manager: 'Encargado de Sucursal',
  barbero: 'Barbero',
  otros: 'Otros',
};

/**
 * Panel de "Equipo de la sucursal" — solo gestiona disponibilidad operativa.
 * NO administra payroll, cargos, acceso, ni PIN (eso vive en Equipo General).
 */
export function EquipoSucursalPanel({ sucursalId, sucursalNombre, organizationId, highlightBarberoId }: Props) {
  const { isOwner, isGeneralManager, isManager } = useAuth();
  const canCreateRecurrente = isOwner || isGeneralManager;
  const canCreateTemporal = isOwner || isGeneralManager || isManager;
  const canDeleteRecurrente = isOwner || isGeneralManager;

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const flagKey = `vittro:miNegocio:highlightBarbero:${organizationId}`;
    let stored: string | null = null;
    try { stored = localStorage.getItem(flagKey); } catch { /* ignore */ }
    const effectiveId = stored || highlightBarberoId || null;
    if (!effectiveId) return;

    if (stored) {
      try { localStorage.removeItem(flagKey); } catch { /* ignore */ }
    }
    setHighlightedId(effectiveId);

    const el = document.querySelector('[data-onboarding-id="equipo-section"]');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    highlightTimeoutRef.current = setTimeout(() => setHighlightedId(null), 2000);
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [organizationId, highlightBarberoId]);

  const bs = useBarberosSucursales(organizationId);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BarberoSucursalRow[]>([]);
  const [barberos, setBarberos] = useState<Record<string, BarberoMini>>({});

  const fetchAll = useCallback(async () => {
    if (!organizationId || !sucursalId) return;
    setLoading(true);
    try {
      const list = await bs.listBySucursal(sucursalId);
      setRows(list);
      const ids = Array.from(new Set(list.map(r => r.barbero_id)));
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from('barberos')
          .select('id, nombre, apellido, rol_equipo, activo')
          .eq('organization_id', organizationId)
          .eq('activo', true)
          .in('id', ids);
        if (error) throw error;
        const map: Record<string, BarberoMini> = {};
        (data ?? []).forEach((b: any) => { map[b.id] = b as BarberoMini; });
        setBarberos(map);
      } else {
        setBarberos({});
      }

    } catch (e: any) {
      console.error('EquipoSucursalPanel fetch error', e);
      toast.error('No se pudo cargar el equipo de la sucursal');
    } finally {
      setLoading(false);
    }
  }, [bs, organizationId, sucursalId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime: invalidar cuando cambia disponibilidad en esta sucursal.
  useBarberosSucursalesRealtime({
    orgId: organizationId,
    sucursalId,
    onChange: () => { void fetchAll(); },
  });

  // Agrupar filas por barbero.
  const grouped = useMemo(() => {
    const g: Record<string, BarberoSucursalRow[]> = {};
    for (const r of rows) {
      (g[r.barbero_id] ??= []).push(r);
    }
    return g;
  }, [rows]);

  const orderedBarberoIds = useMemo(() => {
    return Object.keys(grouped)
      .filter(id => barberos[id])
      .sort((a, b) => {
        const A = barberos[a], B = barberos[b];
        return `${A.nombre} ${A.apellido}`.localeCompare(`${B.nombre} ${B.apellido}`);
      });
  }, [grouped, barberos]);

  // --- Sub-tab Activos/Inactivos ---
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');

  const isActivoBarbero = (list: BarberoSucursalRow[]) => {
    const v = pickVigenteHoy(list);
    return !!v && v.disponible;
  };
  const activeIds = useMemo(
    () => orderedBarberoIds.filter(id => isActivoBarbero(grouped[id] ?? [])),
    [orderedBarberoIds, grouped]
  );
  const inactiveIds = useMemo(
    () => orderedBarberoIds.filter(id => !isActivoBarbero(grouped[id] ?? [])),
    [orderedBarberoIds, grouped]
  );

  // --- Desactivar (set disponible = false sobre la fila vigente) ---
  const [deactivateTarget, setDeactivateTarget] = useState<{ barbero: BarberoMini; row: BarberoSucursalRow } | null>(null);
  const [deactivateFutureCount, setDeactivateFutureCount] = useState<number | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // --- Activar: abre Sheet con barbero preseleccionado ---
  const [activateBarberoId, setActivateBarberoId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const activatePrincipal = async (row: BarberoSucursalRow) => {
    setActivatingId(row.id);
    try {
      await bs.setDisponible(row.id, true);
      toast.success('Barbero activado en esta sucursal');
      await fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo activar');
    } finally {
      setActivatingId(null);
    }
  };

  const openDeactivate = async (barbero: BarberoMini, row: BarberoSucursalRow) => {
    setDeactivateTarget({ barbero, row });
    setDeactivateFutureCount(null);
    try {
      const today = todayLocalIso();
      const { count, error } = await supabase
        .from('turnos')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('sucursal_id', sucursalId)
        .eq('barbero_id', row.barbero_id)
        .gte('fecha', today);
      if (error) setDeactivateFutureCount(0);
      else setDeactivateFutureCount(count ?? 0);
    } catch {
      setDeactivateFutureCount(0);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await bs.setDisponible(deactivateTarget.row.id, false);
      toast.success('Barbero desactivado en esta sucursal');
      setDeactivateTarget(null);
      await fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo desactivar');
    } finally {
      setDeactivating(false);
    }
  };

  const renderBarberoCard = (barberoId: string, isActive: boolean) => {
    const list = grouped[barberoId] ?? [];
    const barbero = barberos[barberoId];
    const vigente = pickVigenteHoy(list);
    const principal = list.find(r => r.tipo === 'principal');
    const temporales = list.filter(r => r.tipo === 'temporal');
    const recurrentes = list.filter(r => r.tipo === 'recurrente');
    const role = barbero?.rol_equipo ? ROLE_LABELS[barbero.rol_equipo] ?? barbero.rol_equipo : null;

    return (
      <div
        key={barberoId}
        className={cn(
          "rounded-lg border border-border bg-muted/20 p-4 transition-shadow duration-700",
          highlightedId === barberoId && "ring-2 ring-primary/40"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground">
                {barbero?.nombre} {barbero?.apellido}
              </span>
              {role && (
                <Badge variant="outline" className="text-xs">{role}</Badge>
              )}
              {vigente ? (
                <Badge variant="secondary" className="text-xs">
                  {vigente.tipo === 'principal' && 'Principal'}
                  {vigente.tipo === 'recurrente' && `Recurrente (${formatDiasSemana(vigente.dias_semana)})`}
                  {vigente.tipo === 'temporal' && `Temporal hasta ${formatShortDate(vigente.fecha_fin)}`}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">Sin asignación vigente hoy</Badge>
              )}
            </div>
          </div>
          <div className="self-start">
            {isActive && vigente && barbero ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => openDeactivate(barbero, vigente)}
              >
                Desactivar
              </Button>
            ) : (
              (canCreateTemporal || canCreateRecurrente) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Activar <ChevronDown className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canCreateTemporal && (
                      <DropdownMenuItem onClick={() => { setActivateBarberoId(barberoId); setTemporalOpen(true); }}>
                        <CalendarIcon className="h-4 w-4 mr-2" /> Asignación temporal
                      </DropdownMenuItem>
                    )}
                    {canCreateRecurrente && (
                      <DropdownMenuItem onClick={() => { setActivateBarberoId(barberoId); setRecurrenteOpen(true); }}>
                        <Repeat className="h-4 w-4 mr-2" /> Asignación automática
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            )}
          </div>
        </div>

        {/* Detalle de asignaciones */}
        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          {principal && (
            <div className="flex items-center justify-between gap-2">
              <span>Principal de esta sucursal.</span>
            </div>
          )}
          {recurrentes.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2">
              <span>
                Recurrente · {formatDiasSemana(r.dias_semana)}
                {r.fecha_inicio && ` · desde ${formatShortDate(r.fecha_inicio)}`}
                {r.fecha_fin && ` · hasta ${formatShortDate(r.fecha_fin)}`}
              </span>
              {canDeleteRecurrente && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDelete(r)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {temporales.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2">
              <span>
                Temporal · {formatShortDate(r.fecha_inicio)} → {formatShortDate(r.fecha_fin)}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDelete(r)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Se recalcula cada noche automáticamente según las asignaciones.
        </p>
      </div>
    );
  };

  // --- Sheets / dialogs ---
  const [temporalOpen, setTemporalOpen] = useState(false);
  const [recurrenteOpen, setRecurrenteOpen] = useState(false);

  // --- Delete confirmation (con check de turnos futuros) ---
  const [deleteTarget, setDeleteTarget] = useState<BarberoSucursalRow | null>(null);
  const [deleteFutureCount, setDeleteFutureCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openDelete = async (row: BarberoSucursalRow) => {
    setDeleteTarget(row);
    setDeleteFutureCount(null);
    // Chequear turnos futuros del barbero en esta sucursal.
    try {
      const today = todayLocalIso();
      const { count, error } = await supabase
        .from('turnos')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('sucursal_id', sucursalId)
        .eq('barbero_id', row.barbero_id)
        .gte('fecha', today);
      if (error) {
        setDeleteFutureCount(0);
      } else {
        setDeleteFutureCount(count ?? 0);
      }
    } catch {
      setDeleteFutureCount(0);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bs.deleteRow(deleteTarget.id);
      toast.success('Asignación eliminada');
      setDeleteTarget(null);
      await fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-muted p-2">
            <CalendarCheck className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">Disponibilidad del equipo</CardTitle>
            <CardDescription>Quién está disponible hoy y asignaciones temporales o automáticas.</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando equipo…
          </div>
        ) : orderedBarberoIds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <MapPin className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Todavía no hay miembros asignados a esta sucursal.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Asigná un miembro desde <span className="font-medium">Mi Negocio › General › Equipo</span> o creá una asignación temporal/recurrente.
            </p>
          </div>
        ) : (
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-md bg-muted/50 p-1">
              <TabsTrigger value="active" className="min-h-8 whitespace-normal px-2 text-xs data-[state=active]:bg-card">
                Activos ({activeIds.length})
              </TabsTrigger>
              <TabsTrigger value="inactive" className="min-h-8 whitespace-normal px-2 text-xs data-[state=active]:bg-card">
                Inactivos ({inactiveIds.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4 space-y-3">
              {activeIds.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">No hay miembros activos en esta sucursal hoy.</p>
                </div>
              ) : (
                activeIds.map(id => renderBarberoCard(id, true))
              )}
            </TabsContent>
            <TabsContent value="inactive" className="mt-4 space-y-3">
              {inactiveIds.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">No hay miembros inactivos en esta sucursal.</p>
                </div>
              ) : (
                inactiveIds.map(id => renderBarberoCard(id, false))
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>


      {/* Sheets */}
      <TemporalSheet
        open={temporalOpen}
        onOpenChange={(o) => { setTemporalOpen(o); if (!o) setActivateBarberoId(null); }}
        organizationId={organizationId}
        sucursalId={sucursalId}
        initialBarberoId={activateBarberoId ?? undefined}
        onCreated={fetchAll}
      />
      {canCreateRecurrente && (
        <RecurrenteSheet
          open={recurrenteOpen}
          onOpenChange={(o) => { setRecurrenteOpen(o); if (!o) setActivateBarberoId(null); }}
          organizationId={organizationId}
          sucursalId={sucursalId}
          initialBarberoId={activateBarberoId ?? undefined}
          onCreated={fetchAll}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteFutureCount != null && deleteFutureCount > 0 && (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              Eliminar asignación
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFutureCount == null
                ? 'Verificando turnos futuros…'
                : deleteFutureCount > 0
                  ? `Este barbero tiene ${deleteFutureCount} turno${deleteFutureCount === 1 ? '' : 's'} futuro${deleteFutureCount === 1 ? '' : 's'} en esta sucursal. Si eliminás esta asignación, esos turnos pueden quedar sin barbero disponible. ¿Querés continuar?`
                  : 'No hay turnos futuros que dependan de esta asignación. ¿Confirmás eliminar?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting || deleteFutureCount == null}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Desactivar confirm */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => { if (!o && !deactivating) setDeactivateTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-destructive" />
              Desactivar de la sucursal
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {deactivateTarget && (
                    <>
                      Vas a desactivar a{' '}
                      <strong className="text-foreground">
                        {deactivateTarget.barbero.nombre} {deactivateTarget.barbero.apellido}
                      </strong>
                      {' '}en esta sucursal. Dejará de aparecer como disponible para recibir turnos hasta que lo actives de nuevo.
                    </>
                  )}
                </p>
                {deactivateFutureCount == null ? (
                  <p className="text-xs">Verificando turnos futuros…</p>
                ) : deactivateFutureCount > 0 ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>
                      Tiene <strong>{deactivateFutureCount}</strong> turno{deactivateFutureCount === 1 ? '' : 's'} futuro{deactivateFutureCount === 1 ? '' : 's'} en esta sucursal. Esos turnos pueden quedar sin barbero disponible.
                    </span>
                  </div>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate} disabled={deactivating || deactivateFutureCount == null}>
              {deactivating ? 'Desactivando…' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>

  );
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

// =========================================================================
//  Sheets para crear temporal / recurrente
// =========================================================================

interface SheetBaseProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  organizationId: string;
  sucursalId: string;
  onCreated: () => void | Promise<void>;
  initialBarberoId?: string;

}

function TemporalSheet({ open, onOpenChange, organizationId, sucursalId, initialBarberoId, onCreated }: SheetBaseProps) {
  const bs = useBarberosSucursales(organizationId);
  const [barberos, setBarberos] = useState<BarberoMini[]>([]);
  const [barberoId, setBarberoId] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>(todayLocalIso());
  const [fechaFin, setFechaFin] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBarberoId(initialBarberoId ?? '');
    setFechaInicio(todayLocalIso());
    setFechaFin('');
    (async () => {
      const { data } = await supabase
        .from('barberos')
        .select('id, nombre, apellido, rol_equipo, activo')
        .eq('organization_id', organizationId)
        .eq('activo', true)
        .order('nombre');
      setBarberos((data ?? []) as BarberoMini[]);
    })();
  }, [open, organizationId, initialBarberoId]);

  const canSave = !!barberoId && !!fechaInicio && !!fechaFin && fechaFin >= fechaInicio;


  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await bs.insertTemporal({
        barbero_id: barberoId,
        sucursal_id: sucursalId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      });
      toast.success('Asignación temporal creada');
      onOpenChange(false);
      await onCreated();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo crear la asignación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Asignación temporal</SheetTitle>
          <SheetDescription>
            Asigná a un barbero a esta sucursal por un período concreto. Al vencer, vuelve solo a su principal.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Barbero</Label>
            <Select value={barberoId} onValueChange={setBarberoId}>
              <SelectTrigger><SelectValue placeholder="Elegí un barbero" /></SelectTrigger>
              <SelectContent>
                {barberos.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre} {b.apellido}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input type="date" value={fechaFin} min={fechaInicio} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>
        </div>
        <SheetFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Creando…' : 'Crear asignación'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RecurrenteSheet({ open, onOpenChange, organizationId, sucursalId, initialBarberoId, onCreated }: SheetBaseProps) {
  const bs = useBarberosSucursales(organizationId);
  const [barberos, setBarberos] = useState<BarberoMini[]>([]);
  const [barberoId, setBarberoId] = useState<string>('');
  const [dias, setDias] = useState<number[]>([]);
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBarberoId(initialBarberoId ?? ''); setDias([]); setFechaInicio(''); setFechaFin('');
    (async () => {
      const { data } = await supabase
        .from('barberos')
        .select('id, nombre, apellido, rol_equipo, activo')
        .eq('organization_id', organizationId)
        .eq('activo', true)
        .order('nombre');
      setBarberos((data ?? []) as BarberoMini[]);
    })();
  }, [open, organizationId, initialBarberoId]);

  const canSave = !!barberoId && dias.length > 0 && (!fechaFin || !fechaInicio || fechaFin >= fechaInicio);

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
      toast.error(e?.message || 'No se pudo crear la asignación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Asignación recurrente</SheetTitle>
          <SheetDescription>
            Asigná un barbero a esta sucursal en días fijos de la semana. Sin componente horario.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Barbero</Label>
            <Select value={barberoId} onValueChange={setBarberoId}>
              <SelectTrigger><SelectValue placeholder="Elegí un barbero" /></SelectTrigger>
              <SelectContent>
                {barberos.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre} {b.apellido}</SelectItem>
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
              <Label className="text-xs text-muted-foreground">Desde (opcional)</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Hasta (opcional)</Label>
              <Input type="date" value={fechaFin} min={fechaInicio || undefined} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>
        </div>
        <SheetFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Creando…' : 'Crear asignación'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
