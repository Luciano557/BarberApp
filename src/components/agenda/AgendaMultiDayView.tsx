import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber } from '@/types/barbershop';
import { Turno, Bloqueo, Servicio } from './hooks/useAgendaData';
import { useBarberColors } from './hooks/useBarberColors';
import { timeToMinutes, formatHHMM } from './lib/timeUtils';
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

function computeLayouts(items: Turno[]) {
  const sorted = [...items].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  const groups: Turno[][] = [];

  sorted.forEach((t) => {
    const tStart = timeToMinutes(t.hora_inicio);
    const tEnd = timeToMinutes(t.hora_fin);
    let placed = false;

    for (const g of groups) {
      const overlaps = g.some((x) => {
        const xs = timeToMinutes(x.hora_inicio);
        const xe = timeToMinutes(x.hora_fin);
        return tStart < xe && xs < tEnd;
      });
      if (overlaps) {
        g.push(t);
        placed = true;
        break;
      }
    }

    if (!placed) groups.push([t]);
  });

  const result = new Map<string, { idx: number; count: number }>();
  groups.forEach((g) => {
    g.forEach((t, i) => result.set(t.id, { idx: i, count: g.length }));
  });
  return result;
}

export function AgendaMultiDayView({
  startDate, daysCount, barbers, turnos, bloqueos, servicios, onTurnoClick, onDayHeaderClick,
}: Props) {
  const MULTI_PX_PER_MIN = 1.9;
  const colors = useBarberColors(barbers.map(b => b.id));
  const days = useMemo(() => Array.from({ length: daysCount }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  }), [startDate, daysCount]);

  const rangeStart = 8 * 60;
  const rangeEnd = 22 * 60;
  const totalHeight = (rangeEnd - rangeStart) * MULTI_PX_PER_MIN;
  const TIME_RAIL_WIDTH = 56;
  const today = new Date();

  const hourRails = useMemo(() => {
    const rails: number[] = [];
    for (let m = rangeStart; m <= rangeEnd; m += 60) rails.push(m);
    return rails;
  }, [rangeStart, rangeEnd]);

  const halfHourRails = useMemo(() => {
    const rails: number[] = [];
    for (let m = rangeStart; m <= rangeEnd; m += 30) {
      if (m % 60 !== 0) rails.push(m);
    }
    return rails;
  }, [rangeStart, rangeEnd]);

  return (
    <div className="bg-card overflow-clip">
      {/* Day header row — sticky, outside scroll container */}
      <div
        className="flex border-b bg-muted/30 sticky top-0 z-40"
        style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}
      >
        <div className="shrink-0 border-r" style={{ width: TIME_RAIL_WIDTH }} />
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}>
          {days.map(d => {
            const isToday = isSameDay(d, today);
            return (
              <button
                key={d.toISOString()}
                onClick={() => onDayHeaderClick?.(d)}
                className={cn(
                  'px-3 py-2 border-r text-left hover:bg-muted/50 transition-colors',
                  isToday && 'bg-primary/5',
                )}
              >
                <div className="text-[10px] uppercase text-muted-foreground">
                  {format(d, 'EEE', { locale: es })}
                </div>
                <div className={cn('text-sm font-medium', isToday && 'text-primary')}>
                  {format(d, 'dd MMM', { locale: es })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable calendar body */}
      <div
        className="overflow-y-auto overscroll-contain"
        style={{ maxHeight: 'clamp(600px, calc(100vh - 180px), 1100px)' }}
      >
        <div className="flex" style={{ height: totalHeight }}>
          {/* Time rail */}
          <div className="shrink-0 border-r relative" style={{ width: TIME_RAIL_WIDTH }}>
            {hourRails.map((m) => (
              <div
                key={m}
                className="absolute left-0 right-0 text-[10px] text-muted-foreground px-1 -translate-y-1/2"
                style={{ top: (m - rangeStart) * MULTI_PX_PER_MIN }}
              >
                {`${String(Math.floor(m / 60)).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="grid flex-1 relative" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}>
            {days.map(d => {
              const dStr = format(d, 'yyyy-MM-dd');
              const dayTurnos = turnos.filter(t => t.fecha === dStr);
              const isToday = isSameDay(d, today);
              const dayOff = bloqueos.find(b =>
                b.barbero_id === null && b.todo_el_dia && b.fecha_inicio <= dStr && b.fecha_fin >= dStr,
              );
              const layouts = computeLayouts(dayTurnos);

              return (
                <div key={dStr} className={cn('border-r relative', isToday && 'bg-primary/5')}>
                  {/* Hour lines */}
                  {hourRails.slice(0, -1).map((m) => (
                    <div
                      key={m}
                      className="absolute left-0 right-0 border-t border-border/40 pointer-events-none"
                      style={{ top: (m - rangeStart) * MULTI_PX_PER_MIN }}
                    />
                  ))}

                  {/* Half-hour dashed lines */}
                  {halfHourRails.map((m) => (
                    <div
                      key={`half-${m}`}
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{
                        top: (m - rangeStart) * MULTI_PX_PER_MIN,
                        borderTop: '1px dashed hsl(232, 30%, 92%)',
                      }}
                    />
                  ))}

                  {/* Appointment cards */}
                  {dayTurnos.map(t => {
                    const top = (timeToMinutes(t.hora_inicio) - rangeStart) * MULTI_PX_PER_MIN;
                    const height = Math.max(18, (timeToMinutes(t.hora_fin) - timeToMinutes(t.hora_inicio)) * MULTI_PX_PER_MIN);
                    const layout = layouts.get(t.id) || { idx: 0, count: 1 };
                    const widthPct = 100 / layout.count;
                    const leftPct = widthPct * layout.idx;
                    const servicio = servicios.find(s => s.id === t.servicio_id);
                    const borderColor = servicio?.linea_color ?? colors[t.barbero_id] ?? 'hsl(var(--primary))';
                    const isPending = t.estado === 'pendiente';
                    const barberObj = barbers.find(b => b.id === t.barbero_id);
                    const barberName = barberObj ? `${barberObj.firstName} ${barberObj.lastName}` : null;

                    return (
                      <button
                        key={t.id}
                        onClick={() => onTurnoClick(t)}
                        className={cn(
                          'absolute rounded-md py-1 px-1.5 overflow-hidden bg-card select-none cursor-pointer hover:shadow-sm transition-all z-20 text-left',
                          isPending ? 'border border-dashed' : 'border',
                        )}
                        style={{
                          top,
                          height,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          borderLeft: `3px solid ${borderColor}`,
                        }}
                      >
                        <div className="text-[9px] font-mono text-muted-foreground leading-tight">
                          {formatHHMM(t.hora_inicio)}
                        </div>
                        <div className="text-[11px] font-semibold text-foreground truncate leading-tight">
                          {t.cliente_nombre || 'Sin nombre'}
                        </div>
                        {height >= 46 && (
                          <div className="text-[9px] text-muted-foreground truncate leading-tight">
                            {servicio?.nombre}
                          </div>
                        )}
                        {height >= 60 && barberName && (
                          <div className="text-[9px] text-muted-foreground truncate leading-tight">
                            {barberName}
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Day-off overlay */}
                  {dayOff && (
                    <div className="absolute inset-0 bg-muted/70 flex items-center justify-center z-30">
                      <span className="text-[10px] text-muted-foreground">Cerrado</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
