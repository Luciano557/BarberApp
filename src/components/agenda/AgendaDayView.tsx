import { useMemo, useRef, useEffect, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { Barber } from '@/types/barbershop';
import { Turno, Bloqueo, Servicio, Horario } from './hooks/useAgendaData';
import { useBarberColors } from './hooks/useBarberColors';
import { timeToMinutes, minutesToTime, formatHHMM, PX_PER_MIN } from './lib/timeUtils';
import { cn } from '@/lib/utils';

interface AgendaDayViewProps {
  date: Date;
  barbers: Barber[];
  turnos: Turno[];
  bloqueos: Bloqueo[];
  servicios: Servicio[];
  horarios: Horario[];
  onTurnoClick: (turno: Turno) => void;
  onSlotClick: (barberoId: string, horaInicio: string) => void;
  onMoveTurno: (turno: Turno, newBarberoId: string, newHoraInicio: string, newFecha: string) => void;
  canDrag: boolean;
}

export function AgendaDayView({
  date, barbers, turnos, bloqueos, servicios, horarios,
  onTurnoClick, onSlotClick, onMoveTurno, canDrag,
}: AgendaDayViewProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayOfWeek = ((date.getDay() + 6) % 7) + 1; // ISO: 1=Mon..7=Sun
  const activeBarbers = useMemo(() => barbers.filter(b => b.active), [barbers]);
  const colors = useBarberColors(activeBarbers.map(b => b.id));

  const dayTurnos = useMemo(() => turnos.filter(t => t.fecha === dateStr), [turnos, dateStr]);
  const dayBloqueos = useMemo(
    () => bloqueos.filter(b => b.fecha_inicio <= dateStr && b.fecha_fin >= dateStr),
    [bloqueos, dateStr],
  );
  const dayOff = dayBloqueos.find(b => b.barbero_id === null && b.todo_el_dia);

  // Determine visible time range
  const { rangeStart, rangeEnd } = useMemo(() => {
    let start = 8 * 60;
    let end = 22 * 60;
    horarios.forEach(h => {
      if (h.dia_semana === dayOfWeek) {
        start = Math.min(start, timeToMinutes(h.hora_inicio));
        end = Math.max(end, timeToMinutes(h.hora_fin));
      }
    });
    dayTurnos.forEach(t => {
      start = Math.min(start, timeToMinutes(t.hora_inicio));
      end = Math.max(end, timeToMinutes(t.hora_fin));
    });
    // Snap to hour
    start = Math.floor(start / 60) * 60;
    end = Math.ceil(end / 60) * 60;
    return { rangeStart: start, rangeEnd: end };
  }, [horarios, dayOfWeek, dayTurnos]);

  const totalMins = rangeEnd - rangeStart;
  const totalHeight = totalMins * PX_PER_MIN;
  const SLOT_MIN = 15;

  // Hour rails
  const hourRails = useMemo(() => {
    const rails: number[] = [];
    for (let m = rangeStart; m <= rangeEnd; m += 60) rails.push(m);
    return rails;
  }, [rangeStart, rangeEnd]);

  // Now line
  const isToday = isSameDay(date, new Date());
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    if (!isToday) return;
    const i = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(i);
  }, [isToday]);

  // Group overlapping turnos per barber
  const turnosByBarber: Record<string, Turno[]> = useMemo(() => {
    const map: Record<string, Turno[]> = {};
    activeBarbers.forEach(b => { map[b.id] = []; });
    dayTurnos.forEach(t => {
      if (!map[t.barbero_id]) map[t.barbero_id] = [];
      map[t.barbero_id].push(t);
    });
    return map;
  }, [activeBarbers, dayTurnos]);

  function computeLayouts(items: Turno[]) {
    // Returns layout: { turno, idx, count }
    const sorted = [...items].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    const groups: Turno[][] = [];
    sorted.forEach(t => {
      const tStart = timeToMinutes(t.hora_inicio);
      const tEnd = timeToMinutes(t.hora_fin);
      let placed = false;
      for (const g of groups) {
        const overlaps = g.some(x => {
          const xs = timeToMinutes(x.hora_inicio);
          const xe = timeToMinutes(x.hora_fin);
          return tStart < xe && xs < tEnd;
        });
        if (overlaps) { g.push(t); placed = true; break; }
      }
      if (!placed) groups.push([t]);
    });
    const result = new Map<string, { idx: number; count: number }>();
    groups.forEach(g => {
      g.forEach((t, i) => result.set(t.id, { idx: i, count: g.length }));
    });
    return result;
  }

  // Bloqueos por barbero
  const bloqueosByBarber: Record<string, Bloqueo[]> = useMemo(() => {
    const map: Record<string, Bloqueo[]> = {};
    activeBarbers.forEach(b => { map[b.id] = []; });
    dayBloqueos.forEach(b => {
      if (b.barbero_id && map[b.barbero_id]) map[b.barbero_id].push(b);
    });
    return map;
  }, [activeBarbers, dayBloqueos]);

  // Horarios resueltos por barbero (override > base)
  const baseHorarios = horarios.filter(h => h.barbero_id === null && h.dia_semana === dayOfWeek);
  function getBarberHorarios(barberoId: string) {
    const overrides = horarios.filter(h => h.barbero_id === barberoId && h.dia_semana === dayOfWeek);
    return overrides.length > 0 ? overrides : baseHorarios;
  }

  const COL_WIDTH = 160;
  const TIME_RAIL_WIDTH = 56;

  const handleDragOver = (e: React.DragEvent) => {
    if (!canDrag || dayOff) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, barberoId: string) => {
    if (!canDrag || dayOff) return;
    e.preventDefault();
    const turnoId = e.dataTransfer.getData('text/turno-id');
    const turno = dayTurnos.find(t => t.id === turnoId) || turnos.find(t => t.id === turnoId);
    if (!turno) return;
    // Compute drop minute relative to column
    const colRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const offsetY = e.clientY - colRect.top;
    const droppedMin = Math.round(offsetY / PX_PER_MIN / SLOT_MIN) * SLOT_MIN + rangeStart;
    onMoveTurno(turno, barberoId, minutesToTime(Math.max(rangeStart, droppedMin)), dateStr);
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex border-b bg-muted/30 sticky top-0 z-20">
        <div className="shrink-0 border-r" style={{ width: TIME_RAIL_WIDTH }} />
        <div className="flex overflow-x-auto">
          {activeBarbers.map(b => (
            <div
              key={b.id}
              className="shrink-0 px-3 py-2 border-r flex items-center gap-2"
              style={{ width: COL_WIDTH, borderLeft: `3px solid ${colors[b.id]}` }}
            >
              <span className="text-sm font-medium truncate">{b.firstName} {b.lastName}</span>
            </div>
          ))}
          {activeBarbers.length === 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground">No hay barberos activos en esta sucursal.</div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex relative" style={{ height: totalHeight }}>
        {/* Time rail */}
        <div className="shrink-0 border-r relative" style={{ width: TIME_RAIL_WIDTH }}>
          {hourRails.map(m => (
            <div
              key={m}
              className="absolute left-0 right-0 text-[10px] text-muted-foreground px-1 -translate-y-1/2"
              style={{ top: (m - rangeStart) * PX_PER_MIN }}
            >
              {minutesToTime(m)}
            </div>
          ))}
        </div>

        {/* Columns */}
        <div className="flex overflow-x-auto relative flex-1">
          {activeBarbers.map(b => {
            const barberTurnos = turnosByBarber[b.id] || [];
            const layouts = computeLayouts(barberTurnos);
            const barberHorarios = getBarberHorarios(b.id);
            const works = barberHorarios.length > 0;
            const blocks = bloqueosByBarber[b.id] || [];

            return (
              <div
                key={b.id}
                className={cn(
                  "shrink-0 border-r relative",
                  !works && "bg-muted/40",
                )}
                style={{ width: COL_WIDTH }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, b.id)}
              >
                {/* Hour grid lines */}
                {hourRails.slice(0, -1).map(m => (
                  <div
                    key={m}
                    className="absolute left-0 right-0 border-t border-border/40"
                    style={{ top: (m - rangeStart) * PX_PER_MIN }}
                  />
                ))}
                {/* Working hours overlay (subtle) */}
                {works && barberHorarios.map(h => {
                  const top = (timeToMinutes(h.hora_inicio) - rangeStart) * PX_PER_MIN;
                  const height = (timeToMinutes(h.hora_fin) - timeToMinutes(h.hora_inicio)) * PX_PER_MIN;
                  return (
                    <div
                      key={h.id}
                      className="absolute left-0 right-0 bg-background"
                      style={{ top, height }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offY = e.clientY - rect.top;
                        const min = Math.round(offY / PX_PER_MIN / SLOT_MIN) * SLOT_MIN + timeToMinutes(h.hora_inicio);
                        onSlotClick(b.id, minutesToTime(min));
                      }}
                    />
                  );
                })}
                {/* Bloqueos del barbero */}
                {blocks.map(bl => {
                  if (bl.todo_el_dia) {
                    return (
                      <div key={bl.id} className="absolute inset-0 bg-muted/60 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground rotate-90">No disponible</span>
                      </div>
                    );
                  }
                  if (!bl.hora_inicio || !bl.hora_fin) return null;
                  const top = (timeToMinutes(bl.hora_inicio) - rangeStart) * PX_PER_MIN;
                  const height = (timeToMinutes(bl.hora_fin) - timeToMinutes(bl.hora_inicio)) * PX_PER_MIN;
                  return (
                    <div
                      key={bl.id}
                      className="absolute left-0 right-0 bg-muted/70 border-l-2 border-muted-foreground/40"
                      style={{ top, height, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, hsl(var(--muted-foreground)/0.15) 6px, hsl(var(--muted-foreground)/0.15) 7px)' }}
                      title={bl.motivo || 'No disponible'}
                    />
                  );
                })}
                {/* Turnos */}
                {barberTurnos.map(t => {
                  const top = (timeToMinutes(t.hora_inicio) - rangeStart) * PX_PER_MIN;
                  const height = Math.max(20, (timeToMinutes(t.hora_fin) - timeToMinutes(t.hora_inicio)) * PX_PER_MIN);
                  const layout = layouts.get(t.id) || { idx: 0, count: 1 };
                  const widthPct = 100 / layout.count;
                  const leftPct = widthPct * layout.idx;
                  const servicio = servicios.find(s => s.id === t.servicio_id);
                  const isPending = t.estado === 'pendiente';
                  return (
                    <div
                      key={t.id}
                      draggable={canDrag && ['pendiente', 'confirmado'].includes(t.estado)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/turno-id', t.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={(e) => { e.stopPropagation(); onTurnoClick(t); }}
                      className={cn(
                        "absolute rounded-md p-1.5 cursor-pointer hover:shadow-sm transition-all overflow-hidden bg-card",
                        isPending ? "border border-dashed" : "border",
                      )}
                      style={{
                        top, height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        borderLeft: `3px solid ${colors[b.id]}`,
                      }}
                    >
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {formatHHMM(t.hora_inicio)}
                      </div>
                      <div className="text-xs font-medium text-foreground truncate">
                        {t.cliente_nombre || 'Sin nombre'}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {servicio?.nombre || 'Servicio'}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Now line */}
          {isToday && nowMin >= rangeStart && nowMin <= rangeEnd && (
            <div
              className="absolute left-0 right-0 h-px bg-destructive z-10 pointer-events-none"
              style={{ top: (nowMin - rangeStart) * PX_PER_MIN }}
            >
              <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-destructive" />
            </div>
          )}

          {/* Día off overlay */}
          {dayOff && (
            <div className="absolute inset-0 bg-muted/70 backdrop-blur-[1px] z-30 flex items-center justify-center">
              <div className="text-center space-y-1 bg-card border rounded-lg px-4 py-3 shadow-sm">
                <div className="text-sm font-medium text-foreground">Día cerrado</div>
                {dayOff.motivo && <div className="text-xs text-muted-foreground">{dayOff.motivo}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
