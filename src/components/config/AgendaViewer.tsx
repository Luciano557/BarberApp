import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, CalendarIcon, User, Clock, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber } from '@/types/barbershop';
import { toast } from 'sonner';

interface AgendaViewerProps {
  sucursalId: string;
  organizationId: string;
  barbers: Barber[];
}

interface Turno {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  barbero_id: string;
  estado: string;
  servicio_id: string;
}

interface ServicioMap {
  [id: string]: string;
}

export function AgendaViewer({ sucursalId, organizationId, barbers }: AgendaViewerProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [servicios, setServicios] = useState<ServicioMap>({});
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<{ turno: Turno; servicioNombre: string } | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reassigning, setReassigning] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const mondayStr = format(weekStart, 'yyyy-MM-dd');
  const sundayStr = format(weekEnd, 'yyyy-MM-dd');

  const fetchTurnos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('turnos')
      .select('id, fecha, hora_inicio, hora_fin, cliente_nombre, cliente_telefono, barbero_id, estado, servicio_id')
      .eq('sucursal_id', sucursalId)
      .gte('fecha', mondayStr)
      .lte('fecha', sundayStr)
      .neq('estado', 'cancelado')
      .order('hora_inicio');
    if (data) setTurnos(data);
    setLoading(false);
  }, [sucursalId, mondayStr, sundayStr]);

  const fetchServicios = useCallback(async () => {
    const { data } = await supabase
      .from('servicios')
      .select('id, nombre')
      .eq('organization_id', organizationId);
    if (data) {
      const map: ServicioMap = {};
      data.forEach(s => { map[s.id] = s.nombre; });
      setServicios(map);
    }
  }, [organizationId]);

  useEffect(() => { fetchServicios(); }, [fetchServicios]);
  useEffect(() => { fetchTurnos(); }, [fetchTurnos]);

  const activeBarbers = barbers.filter(b => b.active);

  const getBarberName = (barberoId: string) => {
    const b = barbers.find(x => x.id === barberoId);
    return b ? `${b.firstName} ${b.lastName}` : 'Desconocido';
  };

  const goToWeek = (offset: number) => setCurrentDate(prev => addWeeks(prev, offset));
  const goToDate = (date: Date | undefined) => {
    if (date) { setCurrentDate(date); setCalendarOpen(false); }
  };

  const isToday = (day: Date) => isSameDay(day, new Date());

  const canCancel = (estado: string) => ['pendiente', 'confirmado'].includes(estado);
  const canReassign = (estado: string) => ['pendiente', 'confirmado'].includes(estado);

  const handleReassign = async (turnoId: string, newBarberId: string) => {
    setReassigning(turnoId);
    try {
      const { error } = await supabase
        .from('turnos')
        .update({ barbero_id: newBarberId })
        .eq('id', turnoId);
      if (error) {
        toast.error('Error al reasignar el turno');
        return;
      }
      toast.success('Turno reasignado correctamente');
      fetchTurnos();
    } catch {
      toast.error('Error al reasignar el turno');
    } finally {
      setReassigning(null);
    }
  };

  const handleCancelTurno = async () => {
    if (!cancelDialog) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('turnos')
        .update({
          estado: 'cancelado',
          cancelado_at: new Date().toISOString(),
          cancelado_motivo: cancelMotivo.trim() || null,
        })
        .eq('id', cancelDialog.turno.id);

      if (error) {
        toast.error('Error al cancelar el turno');
        return;
      }
      toast.success('Turno cancelado correctamente');
      setCancelDialog(null);
      setCancelMotivo('');
      fetchTurnos();
    } catch {
      toast.error('Error al cancelar el turno');
    } finally {
      setCancelling(false);
    }
  };

  const renderTurnoRow = (turno: Turno) => (
    <div key={turno.id} className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
      <span className="flex items-center gap-1 font-mono">
        <Clock className="h-3 w-3" />
        {turno.hora_inicio.slice(0, 5)} - {turno.hora_fin.slice(0, 5)}
      </span>
      <span className="text-foreground">{turno.cliente_nombre || 'Sin nombre'}</span>
      <span className="text-muted-foreground">·</span>
      <span>{servicios[turno.servicio_id] || 'Servicio'}</span>
      {canReassign(turno.estado) && activeBarbers.length > 1 && (
        <Select
          value={turno.barbero_id}
          onValueChange={(newId) => handleReassign(turno.id, newId)}
          disabled={reassigning === turno.id}
        >
          <SelectTrigger className="h-5 w-auto min-w-[100px] text-[10px] border-dashed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {activeBarbers.map(b => (
              <SelectItem key={b.id} value={b.id} className="text-xs">
                {b.firstName} {b.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {canCancel(turno.estado) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-0.5"
          onClick={() => {
            setCancelDialog({ turno, servicioNombre: servicios[turno.servicio_id] || 'Servicio' });
            setCancelMotivo('');
          }}
        >
          <X className="h-3 w-3" />
          Cancelar
        </Button>
      )}
    </div>
  );

  const renderBarberBlock = (barberId: string, barberName: string, barberTurnos: Turno[]) => (
    <div key={barberId} className="pl-2">
      <div className="flex items-center gap-1.5 mb-1">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">{barberName}</span>
      </div>
      <div className="space-y-1 pl-5">
        {barberTurnos.map(renderTurnoRow)}
      </div>
    </div>
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarIcon className="w-4 h-4 text-primary" />
          </div>
          <h4 className="text-sm font-medium text-foreground">Visualizar agenda</h4>
        </div>

        {/* Navigation ribbon */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => goToWeek(-1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Sem. anterior
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {format(weekStart, "EEE dd/MM", { locale: es })} – {format(weekEnd, "EEE dd/MM", { locale: es })}
            </span>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar mode="single" selected={currentDate} onSelect={goToDate} locale={es} />
              </PopoverContent>
            </Popover>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => goToWeek(1)}>
            Sem. siguiente <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Today shortcut */}
        {!isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 })) && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCurrentDate(new Date())}>
            Ir a hoy
          </Button>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Cargando turnos...</div>
        ) : (
          <div className="space-y-3">
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayTurnos = turnos.filter(t => t.fecha === dateStr);
              const dayLabel = format(day, "EEEE dd/MM", { locale: es });

              const turnosByBarber: Record<string, Turno[]> = {};
              dayTurnos.forEach(t => {
                if (!turnosByBarber[t.barbero_id]) turnosByBarber[t.barbero_id] = [];
                turnosByBarber[t.barbero_id].push(t);
              });

              return (
                <Card key={dateStr} className={`border ${isToday(day) ? 'border-primary/50 bg-primary/5' : ''}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm font-medium capitalize ${isToday(day) ? 'text-primary' : 'text-foreground'}`}>
                        {dayLabel}
                      </span>
                      {isToday(day) && <Badge variant="default" className="text-[10px] h-4 px-1.5">Hoy</Badge>}
                      <Badge variant="outline" className="text-[10px] h-4 ml-auto">
                        {dayTurnos.length} turno{dayTurnos.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    {dayTurnos.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-2">Sin turnos</p>
                    ) : (
                      <div className="space-y-2">
                        {activeBarbers
                          .filter(b => turnosByBarber[b.id]?.length > 0)
                          .map(barber => renderBarberBlock(
                            barber.id,
                            `${barber.firstName} ${barber.lastName}`,
                            turnosByBarber[barber.id]
                          ))}
                        {Object.keys(turnosByBarber)
                          .filter(bid => !activeBarbers.some(b => b.id === bid))
                          .map(bid => renderBarberBlock(bid, getBarberName(bid), turnosByBarber[bid]))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Cancel confirmation dialog */}
        <AlertDialog open={!!cancelDialog} onOpenChange={(open) => { if (!open) setCancelDialog(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cancelar este turno?</AlertDialogTitle>
              <AlertDialogDescription>
                {cancelDialog && (
                  <>
                    {cancelDialog.servicioNombre} — {cancelDialog.turno.cliente_nombre || 'Sin nombre'}
                    <br />
                    {cancelDialog.turno.fecha} a las {cancelDialog.turno.hora_inicio.slice(0, 5)}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Textarea
                placeholder="Motivo de cancelación (opcional)"
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                rows={2}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>Volver</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelTurno}
                disabled={cancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cancelling ? 'Cancelando...' : 'Sí, cancelar turno'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
