import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTareas } from '@/hooks/useTareas';
import {
  Plus, Trash2, CheckCircle, Clock, XCircle, RefreshCw, AlertTriangle,
  Users, User, MapPin, CalendarDays, Repeat, Inbox, History, ArrowLeft,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber, getBarberDisplayName } from '@/types/barbershop';
import { TareaFormDialog } from './tareas/TareaFormDialog';
import { getRepeatLabel } from './tareas/RepeatPicker';
import { getCustomRepeatLabel } from './tareas/CustomRepeatSheet';
import { useAuth } from '@/contexts/AuthContext';
import { PinGateDialog } from './PinGateDialog';
import { supabase } from '@/integrations/supabase/client';
import { useSucursal } from '@/contexts/SucursalContext';
import { toast } from 'sonner';

interface TareasPanelProps {
  barbers: Barber[];
}

type TareaItem = ReturnType<typeof useTareas>['tareas'][number];

const ESTADO_OPTIONS_TAREA = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_progreso', label: 'En progreso' },
];

const ESTADO_OPTIONS_PETICION = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'completada', label: 'Completada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'vencida', label: 'Vencida' },
];

const FECHA_OPTIONS = [
  { value: 'todas', label: 'Todas las fechas' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Próximos 7 días' },
  { value: 'mes', label: 'Próximos 30 días' },
  { value: 'vencida', label: 'Vencidas' },
];

export function TareasPanel({ barbers }: TareasPanelProps) {
  const { tareas, isLoading, addTarea, updateTarea, deleteTarea } = useTareas();
  const { canManageConfig, isOwner, isGeneralManager, isManager, isBarber, profile } = useAuth();
  const { currentSucursal, sucursales } = useSucursal();

  const canManageTareas = isOwner || isGeneralManager || isManager;

  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('tareas');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroResp, setFiltroResp] = useState('todos');
  const [filtroFecha, setFiltroFecha] = useState('todas');
  const [filtroSucursal, setFiltroSucursal] = useState('todas');
  const [showCompletedHistory, setShowCompletedHistory] = useState(false);

  const [showPinDialog, setShowPinDialog] = useState(false);
  const [peticionCreador, setPeticionCreador] = useState<{ nombre: string; barberoId: string } | null>(null);
  const [showActionPinDialog, setShowActionPinDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ tareaId: string; action: string } | null>(null);

  const isTareasTab = activeTab === 'tareas';
  const showSucursalFilter = !currentSucursal && sucursales.length > 1;
  const activeBarbers = barbers.filter(b => b.active);
  const myBarberoId = profile?.barbero_id ?? null;

  const getPeticionVencimiento = (t: TareaItem) => {
    const dias = t.vencimiento_dias ?? 60;
    const diasTranscurridos = differenceInDays(new Date(), new Date(t.created_at));
    const diasRestantes = dias - diasTranscurridos;
    return { diasTranscurridos, diasRestantes, vencida: diasRestantes <= 0 };
  };

  const matchesFecha = (t: TareaItem) => {
    if (filtroFecha === 'todas') return true;
    if (filtroFecha === 'vencida') {
      if (t.tipo === 'peticion' && t.estado === 'pendiente') return getPeticionVencimiento(t).vencida;
      if (t.fecha_limite) return new Date(t.fecha_limite) < new Date(new Date().toDateString());
      return false;
    }
    if (!t.fecha_limite) return false;
    const diff = differenceInDays(new Date(t.fecha_limite), new Date());
    if (filtroFecha === 'hoy') return diff === 0;
    if (filtroFecha === 'semana') return diff >= 0 && diff <= 7;
    if (filtroFecha === 'mes') return diff >= 0 && diff <= 30;
    return true;
  };

  const matchesResp = (t: TareaItem) => {
    if (filtroResp === 'todos') return true;
    if (filtroResp === '__team__') return t.assignment_scope === 'team';
    return t.asignado_a_id === filtroResp;
  };

  const matchesSucursal = (t: TareaItem) => {
    if (!showSucursalFilter || filtroSucursal === 'todas') return true;
    return t.sucursal_id === filtroSucursal;
  };

  const tareasFiltradas = useMemo(() => tareas.filter(t => {
    // Excluir SIEMPRE completadas de la vista operativa de tareas (las peticiones se filtran abajo).
    if (t.tipo === 'tarea' && t.estado === 'completada') return false;
    if (filtroEstado !== 'todos') {
      if (filtroEstado === 'vencida') {
        if (!(t.tipo === 'peticion' && t.estado === 'pendiente' && getPeticionVencimiento(t).vencida)) return false;
      } else if (t.estado !== filtroEstado) return false;
    }
    return matchesFecha(t) && matchesSucursal(t) && (t.tipo === 'peticion' || matchesResp(t));
  }), [tareas, filtroEstado, filtroFecha, filtroResp, filtroSucursal]);

  const tareasAdmin = tareasFiltradas.filter(t => t.tipo === 'tarea');
  const peticiones = tareasFiltradas.filter(t => t.tipo === 'peticion');

  const tareasCompletadas = useMemo(() => tareas.filter(t => {
    if (t.tipo !== 'tarea' || t.estado !== 'completada') return false;
    return matchesSucursal(t) && matchesResp(t);
  }), [tareas, filtroResp, filtroSucursal]);

  const getRepeatDisplay = (t: TareaItem) => {
    if (!t.recurrente) return null;
    if (t.repeat_preset === 'custom') {
      return getCustomRepeatLabel(t.repeat_frequency, t.repeat_interval, t.repeat_byweekday);
    }
    if (t.repeat_preset) return getRepeatLabel(t.repeat_preset);
    if (t.recurrencia_tipo === 'dias') return `Cada ${t.frecuencia_dias} días`;
    return 'Recurrente';
  };

  const sucursalNombre = (id: string | null) =>
    id ? (sucursales.find(s => s.id === id)?.nombre ?? null) : null;

  const renderEstadoBadge = (t: TareaItem) => {
    if (t.tipo === 'peticion' && t.estado === 'pendiente') {
      const { vencida, diasRestantes } = getPeticionVencimiento(t);
      if (vencida) return <Badge variant="outline" className="text-status-warning-foreground border-status-warning bg-status-warning-bg gap-1"><AlertTriangle className="w-3 h-3" />Vencida</Badge>;
      if (diasRestantes <= 7) return <Badge variant="outline" className="text-status-warning-foreground border-status-warning bg-status-warning-bg gap-1"><Clock className="w-3 h-3" />Vence en {diasRestantes}d</Badge>;
    }
    switch (t.estado) {
      case 'pendiente': return <Badge variant="outline" className="text-status-warning-foreground border-status-warning bg-status-warning-bg gap-1"><Clock className="w-3 h-3" />Pendiente</Badge>;
      case 'en_progreso': return <Badge variant="outline" className="text-status-info-foreground border-status-info bg-status-info-bg gap-1"><RefreshCw className="w-3 h-3" />En progreso</Badge>;
      case 'completada': return <Badge variant="outline" className="text-status-success-foreground border-status-success bg-status-success-bg gap-1"><CheckCircle className="w-3 h-3" />Completada</Badge>;
      case 'rechazada': return <Badge variant="outline" className="text-status-error-foreground border-status-error bg-status-error-bg gap-1"><XCircle className="w-3 h-3" />Rechazada</Badge>;
      default: return <Badge variant="outline">{t.estado}</Badge>;
    }
  };

  // PIN flows
  const handleNuevaPeticion = () => setShowPinDialog(true);
  const handleNuevaTarea = () => { setPeticionCreador(null); setShowForm(true); };

  const handlePinValidate = async (pin: string) => {
    const { data, error } = await supabase.functions.invoke('validate-pin', {
      body: { pin, sucursal_id: currentSucursal?.id ?? null },
    });
    if (error || !data?.valid) return { success: false };
    setPeticionCreador({ nombre: data.user_name, barberoId: data.barbero_id });
    setShowPinDialog(false);
    setShowForm(true);
    return { success: true, userName: data.user_name };
  };

  const requestPeticionAction = (tareaId: string, action: string) => {
    setPendingAction({ tareaId, action });
    setShowActionPinDialog(true);
  };

  const handleActionPinValidate = async (pin: string) => {
    const { data, error } = await supabase.functions.invoke('validate-pin', {
      body: { pin, sucursal_id: currentSucursal?.id ?? null },
    });
    if (error || !data?.valid) return { success: false };
    setShowActionPinDialog(false);
    if (pendingAction) {
      const { tareaId, action } = pendingAction;
      if (action === 'delete') deleteTarea.mutate(tareaId);
      else updateTarea.mutate({ id: tareaId, estado: action });
      toast.success(`Acción realizada por ${data.user_name}`);
      setPendingAction(null);
    }
    return { success: true, userName: data.user_name };
  };

  // Card renderers
  const TareaCard = ({ t }: { t: TareaItem }) => {
    const isTeam = t.assignment_scope === 'team';
    const isMine = !!myBarberoId && t.asignado_a_id === myBarberoId;
    const canComplete = canManageTareas || (isBarber && !isTeam && isMine);
    const canStart = canComplete;
    const canDelete = canManageTareas;
    const sNombre = sucursalNombre(t.sucursal_id);
    const repeatTxt = getRepeatDisplay(t);

    return (
      <Card className="flex flex-col">
        <CardContent className="p-4 flex flex-col gap-3 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm leading-snug text-foreground line-clamp-2">{t.titulo}</h3>
            {renderEstadoBadge(t)}
          </div>

          {t.descripcion && (
            <p className="text-xs text-muted-foreground line-clamp-2">{t.descripcion}</p>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground mt-auto">
            <span className="inline-flex items-center gap-1">
              {isTeam ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              {isTeam ? 'Todo el equipo' : (t.asignado_a_nombre || 'Sin asignar')}
            </span>
            {sNombre && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{sNombre}
              </span>
            )}
            {t.fecha_limite && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(new Date(t.fecha_limite), 'dd MMM', { locale: es })}
                {t.hora && <span>· {t.hora}</span>}
              </span>
            )}
            {repeatTxt && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="h-3.5 w-3.5" />{repeatTxt}
              </span>
            )}
          </div>

          {(canStart || canComplete || canDelete) && (
            <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
              {canStart && t.estado === 'pendiente' && (
                <Button size="sm" variant="ghost" onClick={() => updateTarea.mutate({ id: t.id, estado: 'en_progreso' })}>
                  <RefreshCw className="h-4 w-4 mr-1" />Iniciar
                </Button>
              )}
              {canComplete && (t.estado === 'pendiente' || t.estado === 'en_progreso') && (
                <Button size="sm" variant="ghost" className="text-status-success-foreground" onClick={() => updateTarea.mutate({ id: t.id, estado: 'completada' })}>
                  <CheckCircle className="h-4 w-4 mr-1" />Completar
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTarea.mutate(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const PeticionCard = ({ t }: { t: TareaItem }) => {
    const venc = t.estado === 'pendiente' ? getPeticionVencimiento(t) : null;
    const sNombre = sucursalNombre(t.sucursal_id);
    return (
      <Card className={`flex flex-col ${venc?.vencida ? 'opacity-70' : ''}`}>
        <CardContent className="p-4 flex flex-col gap-3 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm leading-snug text-foreground line-clamp-2">{t.titulo}</h3>
            {renderEstadoBadge(t)}
          </div>

          {t.descripcion && (
            <p className="text-xs text-muted-foreground line-clamp-2">{t.descripcion}</p>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground mt-auto">
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />{t.creado_por_nombre || '—'}
            </span>
            {sNombre && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{sNombre}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(new Date(t.created_at), 'dd MMM yyyy', { locale: es })}
            </span>
            {venc && !venc.vencida && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />{venc.diasRestantes}d restantes
              </span>
            )}
          </div>

          {t.estado === 'pendiente' && (
            <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
              <Button size="sm" variant="ghost" className="text-status-success-foreground" onClick={() => requestPeticionAction(t.id, 'completada')}>
                <CheckCircle className="h-4 w-4 mr-1" />Completar
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => requestPeticionAction(t.id, 'rechazada')}>
                <XCircle className="h-4 w-4 mr-1" />Rechazar
              </Button>
              {canManageConfig && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => requestPeticionAction(t.id, 'delete')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const CompletadaCard = ({ t }: { t: TareaItem }) => {
    const isTeam = t.assignment_scope === 'team';
    const sNombre = sucursalNombre(t.sucursal_id);
    const completadaAt = (t as TareaItem & { completada_at: string | null }).completada_at;
    const completadaPor = (t as TareaItem & { completada_por_nombre: string | null }).completada_por_nombre;
    return (
      <Card className="flex flex-col">
        <CardContent className="p-4 flex flex-col gap-3 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm leading-snug text-foreground line-clamp-2">{t.titulo}</h3>
            <Badge variant="outline" className="text-status-success-foreground border-status-success bg-status-success-bg gap-1">
              <CheckCircle className="w-3 h-3" />Completada
            </Badge>
          </div>

          {t.descripcion && (
            <p className="text-xs text-muted-foreground line-clamp-2">{t.descripcion}</p>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {isTeam ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              {isTeam ? 'Todo el equipo' : (t.asignado_a_nombre || '—')}
            </span>
            {sNombre && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{sNombre}
              </span>
            )}
            {t.fecha_limite && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(new Date(t.fecha_limite), 'dd MMM', { locale: es })}
                {t.hora && <span>· {t.hora}</span>}
              </span>
            )}
          </div>

          <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-auto space-y-0.5">
            {completadaAt || completadaPor ? (
              <>
                <div className="inline-flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Completada por <span className="text-foreground font-medium">{completadaPor || '—'}</span>
                </div>
                {completadaAt && (
                  <div className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(completadaAt), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                  </div>
                )}
              </>
            ) : (
              <span className="italic">Sin registro de completado</span>
            )}
          </div>

          {canManageTareas && (
            <div className="flex items-center justify-end gap-1">
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTarea.mutate(t.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const EmptyState = ({ label, hint }: { label: string; hint: string }) => (
    <Card>
      <CardContent className="py-12 flex flex-col items-center justify-center gap-2 text-center">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Inbox className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{hint}</p>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  }

  const estadoOptions = isTareasTab ? ESTADO_OPTIONS_TAREA : ESTADO_OPTIONS_PETICION;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Tareas</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Gestioná las tareas internas del equipo, asigná responsables y revisá el estado de cada pendiente operativo.
          </p>
        </div>
        {isTareasTab ? (
          canManageConfig && (
            <Button onClick={handleNuevaTarea} className="self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-2" />Nueva tarea
            </Button>
          )
        ) : (
          <Button onClick={handleNuevaPeticion} className="self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" />Nueva petición
          </Button>
        )}
      </div>

      <TareaFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        barbers={barbers}
        onSubmit={tarea => addTarea.mutate(tarea)}
        isPending={addTarea.isPending}
        tipo={isTareasTab ? 'tarea' : 'peticion'}
        creadorNombre={peticionCreador?.nombre}
      />

      <PinGateDialog
        open={showPinDialog}
        onValidate={handlePinValidate}
        onClose={() => setShowPinDialog(false)}
        sectionName="crear una petición"
      />
      <PinGateDialog
        open={showActionPinDialog}
        onValidate={handleActionPinValidate}
        onClose={() => { setShowActionPinDialog(false); setPendingAction(null); }}
        sectionName="gestionar esta petición"
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setFiltroEstado('todos'); }}>
        <TabsList>
          <TabsTrigger value="tareas">Tareas ({tareasAdmin.length})</TabsTrigger>
          <TabsTrigger value="peticiones">Peticiones ({peticiones.length})</TabsTrigger>
        </TabsList>

        {/* Filters bar */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {estadoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {isTareasTab && (
            <Select value={filtroResp} onValueChange={setFiltroResp}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Responsable" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los responsables</SelectItem>
                <SelectItem value="__team__">Todo el equipo</SelectItem>
                {activeBarbers.map(b => (
                  <SelectItem key={b.id} value={b.id}>{getBarberDisplayName(b)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={filtroFecha} onValueChange={setFiltroFecha}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FECHA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {showSucursalFilter && (
            <Select value={filtroSucursal} onValueChange={setFiltroSucursal}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las sucursales</SelectItem>
                {sucursales.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="tareas" className="mt-4">
          {tareasAdmin.length === 0 ? (
            <EmptyState
              label="No hay tareas"
              hint={canManageConfig ? 'Creá una tarea para asignarla a un barbero o a todo el equipo.' : 'Aún no tenés tareas asignadas.'}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {tareasAdmin.map(t => <TareaCard key={t.id} t={t} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="peticiones" className="mt-4">
          {peticiones.length === 0 ? (
            <EmptyState
              label="No hay peticiones"
              hint="Las peticiones del equipo aparecerán acá para que las gestiones."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {peticiones.map(t => <PeticionCard key={t.id} t={t} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
