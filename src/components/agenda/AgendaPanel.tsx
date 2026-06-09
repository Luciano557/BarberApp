import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronLeft, ChevronRight, CalendarIcon, Plus, CalendarPlus, Ban, CalendarX } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber } from '@/types/barbershop';
import { useAgendaData, Turno } from './hooks/useAgendaData';
import { AgendaDayView } from './AgendaDayView';
import { AgendaMultiDayView } from './AgendaMultiDayView';
import { NewAppointmentDialog } from './NewAppointmentDialog';
import { UnavailableSlotDialog } from './UnavailableSlotDialog';
import { DayOffDialog } from './DayOffDialog';
import { AppointmentDetailDialog } from './AppointmentDetailDialog';
import { MoveConfirmDialog } from './MoveConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { timeToMinutes, minutesToTime } from './lib/timeUtils';

type ViewMode = 'day' | '3days' | 'week';

interface AgendaPanelProps {
  sucursalId: string;
  organizationId: string;
  sucursalTimezone?: string | null;
  barbers: Barber[];
}

export function AgendaPanel({ sucursalId, organizationId, sucursalTimezone, barbers }: AgendaPanelProps) {
  const { isOwner, isGeneralManager, isManager, isBarber } = useAuth();
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>('day');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [newApptOpen, setNewApptOpen] = useState(false);
  const [newApptDefaults, setNewApptDefaults] = useState<{ barberId?: string; horaInicio?: string }>({});
  const [unavOpen, setUnavOpen] = useState(false);
  const [dayOffOpen, setDayOffOpen] = useState(false);
  const [detailTurno, setDetailTurno] = useState<Turno | null>(null);

  const [moveDialog, setMoveDialog] = useState<{
    turno: Turno; newBarberoId: string; newHoraInicio: string; newHoraFin: string; newFecha: string;
  } | null>(null);
  const [movingLoading, setMovingLoading] = useState(false);

  const canManageAgenda = isOwner || isGeneralManager || isManager;
  const canCreateDayOff = canManageAgenda;
  const canDrag = canManageAgenda;

  const { fromDate, toDate } = useMemo(() => {
    if (view === 'day') return { fromDate: date, toDate: date };
    if (view === '3days') return { fromDate: date, toDate: addDays(date, 2) };
    const ws = startOfWeek(date, { weekStartsOn: 1 });
    const we = endOfWeek(date, { weekStartsOn: 1 });
    return { fromDate: ws, toDate: we };
  }, [view, date]);

  const { turnos, bloqueos, servicios, horarios, refetch } = useAgendaData(
    sucursalId, organizationId, fromDate, toDate,
  );

  const handlePrev = () => {
    if (view === 'day') setDate(d => addDays(d, -1));
    else if (view === '3days') setDate(d => addDays(d, -3));
    else setDate(d => addDays(d, -7));
  };
  const handleNext = () => {
    if (view === 'day') setDate(d => addDays(d, 1));
    else if (view === '3days') setDate(d => addDays(d, 3));
    else setDate(d => addDays(d, 7));
  };

  const handleSlotClick = (barberoId: string, horaInicio: string) => {
    if (!canManageAgenda) return;
    setNewApptDefaults({ barberId: barberoId, horaInicio });
    setNewApptOpen(true);
  };

  const handleMoveTurno = (turno: Turno, newBarberoId: string, newHoraInicio: string, newFecha: string) => {
    if (!canManageAgenda) return;
    // Validaciones front
    const newBarber = barbers.find(b => b.id === newBarberoId);
    if (!newBarber || !newBarber.active) {
      toast.error('El barbero no es válido');
      return;
    }
    if (!['pendiente', 'confirmado'].includes(turno.estado)) {
      toast.error('Este turno no se puede mover');
      return;
    }
    const dur = timeToMinutes(turno.hora_fin) - timeToMinutes(turno.hora_inicio);
    const newHoraFin = minutesToTime(timeToMinutes(newHoraInicio) + dur);
    setMoveDialog({ turno, newBarberoId, newHoraInicio, newHoraFin, newFecha });
  };

  const confirmMove = async () => {
    if (!canManageAgenda) return;
    if (!moveDialog) return;
    setMovingLoading(true);
    const { turno, newBarberoId, newHoraInicio, newHoraFin, newFecha } = moveDialog;
    const { error } = await supabase.from('turnos').update({
      barbero_id: newBarberoId,
      hora_inicio: newHoraInicio,
      hora_fin: newHoraFin,
      fecha: newFecha,
    }).eq('id', turno.id);
    setMovingLoading(false);
    if (error) {
      toast.error('No se pudo mover el turno');
      return;
    }
    toast.success('Turno actualizado');
    setMoveDialog(null);
    refetch();
  };

  const titleLabel = useMemo(() => {
    if (view === 'day') return format(date, "EEEE dd 'de' MMMM yyyy", { locale: es });
    if (view === '3days') return `${format(fromDate, 'dd MMM', { locale: es })} – ${format(toDate, 'dd MMM yyyy', { locale: es })}`;
    return `${format(fromDate, 'dd MMM', { locale: es })} – ${format(toDate, 'dd MMM yyyy', { locale: es })}`;
  }, [view, date, fromDate, toDate]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>Hoy</Button>
          <div className="flex">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-r-none" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-l-none border-l-0" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span className="capitalize">{titleLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarUI
                mode="single"
                selected={date}
                onSelect={(d) => { if (d) { setDate(d); setCalendarOpen(false); } }}
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as ViewMode)} size="sm">
            <ToggleGroupItem value="day" className="text-xs px-3">Día</ToggleGroupItem>
            <ToggleGroupItem value="3days" className="text-xs px-3">3 días</ToggleGroupItem>
            <ToggleGroupItem value="week" className="text-xs px-3">Semana</ToggleGroupItem>
          </ToggleGroup>

          {canManageAgenda && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" /> Añadir
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setNewApptDefaults({}); setNewApptOpen(true); }}>
                  <CalendarPlus className="h-4 w-4" /> Cita
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setUnavOpen(true)}>
                  <Ban className="h-4 w-4" /> Horario no disponible
                </DropdownMenuItem>
                {canCreateDayOff && (
                  <DropdownMenuItem onClick={() => setDayOffOpen(true)}>
                    <CalendarX className="h-4 w-4" /> Día off
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Vista */}
      {view === 'day' && (
        <AgendaDayView
          date={date}
          barbers={barbers}
          turnos={turnos}
          bloqueos={bloqueos}
          servicios={servicios}
          horarios={horarios}
          onTurnoClick={setDetailTurno}
          onSlotClick={handleSlotClick}
          onMoveTurno={handleMoveTurno}
          canDrag={canDrag}
        />
      )}
      {view === '3days' && (
        <AgendaMultiDayView
          startDate={fromDate}
          daysCount={3}
          barbers={barbers}
          turnos={turnos}
          bloqueos={bloqueos}
          servicios={servicios}
          onTurnoClick={setDetailTurno}
          onDayHeaderClick={(d) => { setDate(d); setView('day'); }}
        />
      )}
      {view === 'week' && (
        <AgendaMultiDayView
          startDate={fromDate}
          daysCount={7}
          barbers={barbers}
          turnos={turnos}
          bloqueos={bloqueos}
          servicios={servicios}
          onTurnoClick={setDetailTurno}
          onDayHeaderClick={(d) => { setDate(d); setView('day'); }}
        />
      )}

      <NewAppointmentDialog
        open={newApptOpen}
        onOpenChange={setNewApptOpen}
        organizationId={organizationId}
        sucursalId={sucursalId}
        sucursalTimezone={sucursalTimezone || 'America/Argentina/Buenos_Aires'}
        barbers={barbers}
        servicios={servicios}
        defaultDate={date}
        defaultBarberId={newApptDefaults.barberId}
        defaultHoraInicio={newApptDefaults.horaInicio}
        onCreated={refetch}
      />
      <UnavailableSlotDialog
        open={unavOpen}
        onOpenChange={setUnavOpen}
        organizationId={organizationId}
        sucursalId={sucursalId}
        barbers={barbers}
        defaultDate={date}
        onCreated={refetch}
      />
      <DayOffDialog
        open={dayOffOpen}
        onOpenChange={setDayOffOpen}
        organizationId={organizationId}
        sucursalId={sucursalId}
        defaultDate={date}
        onCreated={refetch}
      />
      <AppointmentDetailDialog
        open={!!detailTurno}
        onOpenChange={(v) => { if (!v) setDetailTurno(null); }}
        turno={detailTurno}
        organizationId={organizationId}
        sucursalId={sucursalId}
        barbers={barbers}
        servicios={servicios}
        onChanged={refetch}
        readOnly={!canManageAgenda}
      />
      <MoveConfirmDialog
        open={!!moveDialog}
        onOpenChange={(v) => { if (!v) setMoveDialog(null); }}
        turno={moveDialog?.turno || null}
        newBarberId={moveDialog?.newBarberoId || ''}
        newHoraInicio={moveDialog?.newHoraInicio || ''}
        newHoraFin={moveDialog?.newHoraFin || ''}
        newFecha={moveDialog?.newFecha || ''}
        barbers={barbers}
        onConfirm={confirmMove}
        loading={movingLoading}
      />
    </div>
  );
}
