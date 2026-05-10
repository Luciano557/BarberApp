import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber } from '@/types/barbershop';
import { Turno, Bloqueo, Servicio } from './hooks/useAgendaData';
import { useBarberColors } from './hooks/useBarberColors';
import { timeToMinutes, formatHHMM, PX_PER_MIN } from './lib/timeUtils';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface Props {
  startDate: Date;
  daysCount: number;
  barbers: Barber[];
  turnos: Turno[];
  bloqueos: Bloqueo[];
  servicios: Servicio[];
  onTurnoClick: (t: Turno) => void;
  onDayHeaderClick?: (d: Date) => void;
}

export function AgendaMultiDayView({
  startDate, daysCount, barbers, turnos, bloqueos, servicios, onTurnoClick, onDayHeaderClick,
}: Props) {
  const colors = useBarberColors(barbers.map(b => b.id));
  const days = useMemo(() => Array.from({ length: daysCount }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  }), [startDate, daysCount]);

  const rangeStart = 8 * 60;
  const rangeEnd = 22 * 60;
  const totalHeight = (rangeEnd - rangeStart) * PX_PER_MIN;
  const TIME_RAIL_WIDTH = 56;
  const today = new Date();

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="flex border-b bg-muted/30">
        <div className="shrink-0 border-r" style={{ width: TIME_RAIL_WIDTH }} />
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}>
          {days.map(d => {
            const isToday = isSameDay(d, today);
            return (
              <button
                key={d.toISOString()}
                onClick={() => onDayHeaderClick?.(d)}
                className={cn(
                  "px-3 py-2 border-r text-left hover:bg-muted/50 transition-colors",
                  isToday && "bg-primary/5",
                )}
              >
                <div className="text-[10px] uppercase text-muted-foreground">
                  {format(d, 'EEE', { locale: es })}
                </div>
                <div className={cn("text-sm font-medium", isToday && "text-primary")}>
                  {format(d, 'dd MMM', { locale: es })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex" style={{ height: totalHeight }}>
        <div className="shrink-0 border-r relative" style={{ width: TIME_RAIL_WIDTH }}>
          {Array.from({ length: (rangeEnd - rangeStart) / 60 + 1 }, (_, i) => {
            const m = rangeStart + i * 60;
            return (
              <div
                key={m}
                className="absolute left-0 right-0 text-[10px] text-muted-foreground px-1 -translate-y-1/2"
                style={{ top: (m - rangeStart) * PX_PER_MIN }}
              >
                {`${String(Math.floor(m / 60)).padStart(2, '0')}:00`}
              </div>
            );
          })}
        </div>
        <div className="grid flex-1 relative" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}>
          {days.map(d => {
            const dStr = format(d, 'yyyy-MM-dd');
            const dayTurnos = turnos.filter(t => t.fecha === dStr);
            const isToday = isSameDay(d, today);
            const dayOff = bloqueos.find(b => b.barbero_id === null && b.todo_el_dia && b.fecha_inicio <= dStr && b.fecha_fin >= dStr);
            return (
              <div key={dStr} className={cn("border-r relative", isToday && "bg-primary/5")}>
                {Array.from({ length: (rangeEnd - rangeStart) / 60 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-border/40"
                    style={{ top: i * 60 * PX_PER_MIN }}
                  />
                ))}
                {dayTurnos.map(t => {
                  const top = (timeToMinutes(t.hora_inicio) - rangeStart) * PX_PER_MIN;
                  const height = Math.max(18, (timeToMinutes(t.hora_fin) - timeToMinutes(t.hora_inicio)) * PX_PER_MIN);
                  const servicio = servicios.find(s => s.id === t.servicio_id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => onTurnoClick(t)}
                      className="absolute left-1 right-1 rounded-md p-1 text-left bg-card border hover:shadow-sm overflow-hidden"
                      style={{ top, height, borderLeft: `3px solid ${colors[t.barbero_id] || 'hsl(var(--primary))'}` }}
                    >
                      <div className="text-[9px] font-mono text-muted-foreground">{formatHHMM(t.hora_inicio)}</div>
                      <div className="text-[11px] font-medium truncate">{t.cliente_nombre || 'Sin nombre'}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{servicio?.nombre}</div>
                    </button>
                  );
                })}
                {dayOff && (
                  <div className="absolute inset-0 bg-muted/70 flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">Cerrado</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
