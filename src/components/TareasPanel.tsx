import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTareas } from '@/hooks/useTareas';
import { Plus, Trash2, CheckCircle, Clock, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber } from '@/types/barbershop';
import { TareaFormDialog } from './tareas/TareaFormDialog';
import { getRepeatLabel } from './tareas/RepeatPicker';
import { getCustomRepeatLabel } from './tareas/CustomRepeatSheet';
import { useAuth } from '@/contexts/AuthContext';

import { PinGateDialog } from './PinGateDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TareasPanelProps {
  barbers: Barber[];
}

export function TareasPanel({ barbers }: TareasPanelProps) {
  const { tareas, isLoading, addTarea, updateTarea, deleteTarea } = useTareas();
  const [showForm, setShowForm] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const { canManageConfig } = useAuth();
  
  const [activeTab, setActiveTab] = useState('tareas');

  // PIN flow for creating peticiones
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [peticionCreador, setPeticionCreador] = useState<{ nombre: string; barberoId: string } | null>(null);

  // PIN flow for actions on peticiones (completar/rechazar/eliminar)
  const [showActionPinDialog, setShowActionPinDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ tareaId: string; action: string } | null>(null);

  const getPeticionVencimiento = (t: typeof tareas[0]) => {
    const dias = t.vencimiento_dias ?? 60;
    const diasTranscurridos = differenceInDays(new Date(), new Date(t.created_at));
    const diasRestantes = dias - diasTranscurridos;
    return { diasTranscurridos, diasRestantes, vencida: diasRestantes <= 0 };
  };

  const tareasFiltradas = tareas.filter(t => {
    if (filtroEstado === 'todos') return true;
    if (filtroEstado === 'vencida') {
      return t.tipo === 'peticion' && t.estado === 'pendiente' && getPeticionVencimiento(t).vencida;
    }
    return t.estado === filtroEstado;
  });

  const tareasAdmin = tareasFiltradas.filter(t => t.tipo === 'tarea');
  const peticiones = tareasFiltradas.filter(t => t.tipo === 'peticion');

  const isTareasTab = activeTab === 'tareas';
  const titulo = isTareasTab ? 'Tareas' : 'Peticiones';

  const getEstadoBadge = (estado: string, tarea?: typeof tareas[0]) => {
    if (tarea && tarea.tipo === 'peticion' && estado === 'pendiente') {
      const { vencida, diasRestantes } = getPeticionVencimiento(tarea);
      if (vencida) {
        return <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50"><AlertTriangle className="w-3 h-3 mr-1" />Vencida</Badge>;
      }
      if (diasRestantes <= 7) {
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50"><Clock className="w-3 h-3 mr-1" />Vence en {diasRestantes}d</Badge>;
      }
    }

    switch (estado) {
      case 'pendiente':
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case 'en_progreso':
        return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50"><RefreshCw className="w-3 h-3 mr-1" />En progreso</Badge>;
      case 'completada':
        return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle className="w-3 h-3 mr-1" />Completada</Badge>;
      case 'rechazada':
        return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50"><XCircle className="w-3 h-3 mr-1" />Rechazada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const getRepeatDisplay = (t: typeof tareas[0]) => {
    if (!t.recurrente) return '—';
    if (t.repeat_preset === 'custom') {
      return getCustomRepeatLabel(t.repeat_frequency, t.repeat_interval, t.repeat_byweekday);
    }
    if (t.repeat_preset) return getRepeatLabel(t.repeat_preset);
    if (t.recurrencia_tipo === 'dias') return `Cada ${t.frecuencia_dias} días`;
    return 'Recurrente';
  };

  // --- PIN flows ---

  const handleNuevaPeticion = () => {
    setShowPinDialog(true);
  };

  const handlePinValidate = async (pin: string): Promise<{ success: boolean; userName?: string }> => {
    const { data, error } = await supabase.functions.invoke('validate-pin', {
      body: { pin },
    });
    if (error || !data?.valid) {
      return { success: false };
    }
    setPeticionCreador({ nombre: data.user_name, barberoId: data.barbero_id });
    setShowPinDialog(false);
    setShowForm(true);
    return { success: true, userName: data.user_name };
  };

  const handleNuevaTarea = () => {
    setPeticionCreador(null);
    setShowForm(true);
  };

  // Actions on peticiones require PIN
  const requestPeticionAction = (tareaId: string, action: string) => {
    setPendingAction({ tareaId, action });
    setShowActionPinDialog(true);
  };

  const handleActionPinValidate = async (pin: string): Promise<{ success: boolean; userName?: string }> => {
    const { data, error } = await supabase.functions.invoke('validate-pin', {
      body: { pin },
    });
    if (error || !data?.valid) {
      return { success: false };
    }

    // Check if the person has owner/manager role by checking canManageConfig context
    // The RLS policies will enforce this on the server side anyway
    setShowActionPinDialog(false);

    if (pendingAction) {
      const { tareaId, action } = pendingAction;
      if (action === 'delete') {
        deleteTarea.mutate(tareaId);
      } else {
        updateTarea.mutate({ id: tareaId, estado: action });
      }
      toast.success(`Acción realizada por ${data.user_name}`);
      setPendingAction(null);
    }

    return { success: true, userName: data.user_name };
  };

  // --- Tables ---

  const renderTareasTable = (items: typeof tareas) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Asignado a</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Repetir</TableHead>
          <TableHead>Fecha límite</TableHead>
          <TableHead>Creado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              No hay tareas
            </TableCell>
          </TableRow>
        ) : items.map(t => (
          <TableRow key={t.id}>
            <TableCell>
              <div>
                <p className="font-medium">{t.titulo}</p>
                {t.descripcion && <p className="text-xs text-muted-foreground mt-1">{t.descripcion}</p>}
              </div>
            </TableCell>
            <TableCell>{t.asignado_a_nombre || '—'}</TableCell>
            <TableCell>{getEstadoBadge(t.estado)}</TableCell>
            <TableCell>
              <span className="text-xs text-muted-foreground">{getRepeatDisplay(t)}</span>
            </TableCell>
            <TableCell>
              {t.fecha_limite ? (
                <div>
                  <span>{format(new Date(t.fecha_limite), 'dd/MM/yyyy')}</span>
                  {t.hora && <span className="text-xs text-muted-foreground ml-1">{t.hora}</span>}
                </div>
              ) : '—'}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {format(new Date(t.created_at), 'dd/MM/yy', { locale: es })}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {t.estado === 'pendiente' && (
                  <Button size="sm" variant="ghost" onClick={() => updateTarea.mutate({ id: t.id, estado: 'en_progreso' })} title="En progreso">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {(t.estado === 'pendiente' || t.estado === 'en_progreso') && (
                  <Button size="sm" variant="ghost" className="text-green-600" onClick={() => updateTarea.mutate({ id: t.id, estado: 'completada' })} title="Completar">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
                {canManageConfig && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTarea.mutate(t.id)} title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderPeticionesTable = (items: typeof tareas) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Creado por</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Vence</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No hay peticiones
            </TableCell>
          </TableRow>
        ) : items.map(t => {
          const venc = t.estado === 'pendiente' ? getPeticionVencimiento(t) : null;
          return (
            <TableRow key={t.id} className={venc?.vencida ? 'opacity-60' : ''}>
              <TableCell>
                <div>
                  <p className="font-medium">{t.titulo}</p>
                  {t.descripcion && <p className="text-xs text-muted-foreground mt-1">{t.descripcion}</p>}
                </div>
              </TableCell>
              <TableCell>{t.creado_por_nombre || '—'}</TableCell>
              <TableCell>{getEstadoBadge(t.estado, t)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {t.estado === 'pendiente' && venc ? (
                  venc.vencida 
                    ? <span className="text-orange-600 font-medium">Vencida</span>
                    : <span>{venc.diasRestantes}d restantes</span>
                ) : '—'}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {format(new Date(t.created_at), 'dd/MM/yy', { locale: es })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {t.estado === 'pendiente' && (
                    <Button size="sm" variant="ghost" className="text-green-600" onClick={() => requestPeticionAction(t.id, 'completada')} title="Completar">
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                  {t.estado === 'pendiente' && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => requestPeticionAction(t.id, 'rechazada')} title="Rechazar">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => requestPeticionAction(t.id, 'delete')} title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">{titulo}</h1>
        {isTareasTab ? (
          canManageConfig && (
            <Button onClick={handleNuevaTarea}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva tarea
            </Button>
          )
        ) : (
          <Button onClick={handleNuevaPeticion}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva petición
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

      {/* PIN para crear petición */}
      <PinGateDialog
        open={showPinDialog}
        onValidate={handlePinValidate}
        onClose={() => setShowPinDialog(false)}
        sectionName="crear una petición"
      />

      {/* PIN para acciones sobre peticiones */}
      <PinGateDialog
        open={showActionPinDialog}
        onValidate={handleActionPinValidate}
        onClose={() => { setShowActionPinDialog(false); setPendingAction(null); }}
        sectionName="gestionar esta petición"
      />

      {/* Filtro de estado */}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Filtrar:</Label>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_progreso">En progreso</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
        {!isTareasTab && <SelectItem value="vencida">Vencida</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tareas">Tareas ({tareasAdmin.length})</TabsTrigger>
          <TabsTrigger value="peticiones">Peticiones ({peticiones.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="tareas">
          <Card>
            <CardContent className="p-0">
              {renderTareasTable(tareasAdmin)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="peticiones">
          <Card>
            <CardContent className="p-0">
              {renderPeticionesTable(peticiones)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
