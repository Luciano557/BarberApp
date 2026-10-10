import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber } from '@/types/barbershop';
import { Turno, Bloqueo, Servicio } from './hooks/useAgendaData';
import { useBarberColors } from './hooks/useBarberColors';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MULTI_PX_PER_MIN, MULTI_RANGE_START, MULTI_RANGE_END } from './lib/multiDayLayout';
import { useAgendaBodyHeight } from './hooks/useAgendaBodyHeight';
import { AgendaMultiDayColumn } from './AgendaMultiDayColumn';

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

// Mismo contrato que AgendaDayView (columna con ancho mínimo usable + scroll
// horizontal local cuando no entra), medido empíricamente para esta vista con
// el componente real de tarjeta de turno — ver docs/DECISIONES.md. 128px es
// donde un nombre realista de barbero ("Francisco Rodríguez", 20 caracteres)
// deja de truncarse en `AgendaMultiDayTurnoCard`; a 96/112px ya se corta.
const MIN_COL_WIDTH = 128;
const TIME_RAIL_WIDTH = 56;

export function AgendaMultiDayView({
  startDate, daysCount, barbers, turnos, bloqueos, servicios, onTurnoClick, onDayHeaderClick,
}: Props) {
  const colors = useBarberColors(barbers.map(b => b.id));
  const days = useMemo(() => Array.from({ length: daysCount }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  }), [startDate, daysCount]);

  const totalHeight = (MULTI_RANGE_END - MULTI_RANGE_START) * MULTI_PX_PER_MIN;
  const today = new Date();

  const hourRails = useMemo(() => {
    const rails: number[] = [];
    for (let m = MULTI_RANGE_START; m <= MULTI_RANGE_END; m += 60) rails.push(m);
    return rails;
  }, []);

  const halfHourRails = useMemo(() => {
    const rails: number[] = [];
    for (let m = MULTI_RANGE_START; m <= MULTI_RANGE_END; m += 30) {
      if (m % 60 !== 0) rails.push(m);
    }
    return rails;
  }, []);

  // Ancho de columna: mismo patrón de AgendaDayView (medir el contenedor real
  // vía ResizeObserver, nunca un breakpoint) — la columna crece si sobra
  // espacio, nunca baja de MIN_COL_WIDTH; si el conjunto no entra, scroll
  // horizontal local (abajo) en vez de comprimir.
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colWidth = useMemo(() => {
    if (daysCount === 0 || containerWidth === 0) return MIN_COL_WIDTH;
    return Math.max(MIN_COL_WIDTH, (containerWidth - TIME_RAIL_WIDTH) / daysCount);
  }, [containerWidth, daysCount]);

  // Header y body comparten una sola fuente de scroll horizontal —
  // sincronizados a mano (mismo mecanismo que AgendaDayView) para que nunca
  // se desalineen entre sí.
  const headerRowRef = useRef<HTMLDivElement | null>(null);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyColumnsScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);

  const handleHeaderScroll = useCallback(() => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (bodyColumnsScrollRef.current && headerScrollRef.current) {
      bodyColumnsScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  }, []);

  const handleBodyColumnsScroll = useCallback(() => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (headerScrollRef.current && bodyColumnsScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyColumnsScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  }, []);

  const bodyMaxHeight = useAgendaBodyHeight(outerRef, headerRowRef);

  return (
    <div ref={outerRef} className="bg-card overflow-clip">
      {/* Day header row — sticky, sincronizada horizontalmente con el body */}
      <div
        ref={headerRowRef}
        className="flex border-b bg-muted/30 sticky top-0 z-20"
        style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}
      >
        <div className="shrink-0 border-r" style={{ width: TIME_RAIL_WIDTH }} />
        <div ref={headerScrollRef} className="flex overflow-x-auto scrollbar-hide" onScroll={handleHeaderScroll}>
          {days.map(d => {
            const isToday = isSameDay(d, today);
            return (
              <button
                key={d.toISOString()}
                onClick={() => onDayHeaderClick?.(d)}
                className={cn(
                  'shrink-0 px-3 py-2 border-r text-left hover:bg-muted/50 transition-colors',
                  isToday && 'bg-primary/5',
                )}
                style={{ width: colWidth }}
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
        style={{ maxHeight: bodyMaxHeight }}
      >
        <div className="flex" style={{ height: totalHeight }}>
          {/* Time rail — fuera del scroller horizontal, permanece fijo */}
          <div className="shrink-0 border-r relative" style={{ width: TIME_RAIL_WIDTH }}>
            {hourRails.map((m) => (
              <div
                key={m}
                className="absolute left-0 right-0 text-[10px] text-muted-foreground px-1 -translate-y-1/2"
                style={{ top: (m - MULTI_RANGE_START) * MULTI_PX_PER_MIN }}
              >
                {`${String(Math.floor(m / 60)).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div
            ref={bodyColumnsScrollRef}
            className="flex overflow-x-auto relative flex-1"
            onScroll={handleBodyColumnsScroll}
          >
            {days.map(d => {
              const dStr = format(d, 'yyyy-MM-dd');
              const dayTurnos = turnos.filter(t => t.fecha === dStr);
              const isToday = isSameDay(d, today);
              const dayOff = bloqueos.find(b =>
                b.barbero_id === null && b.todo_el_dia && b.fecha_inicio <= dStr && b.fecha_fin >= dStr,
              );

              return (
                <div key={dStr} className="shrink-0" style={{ width: colWidth }}>
                  <AgendaMultiDayColumn
                    isToday={isToday}
                    dayTurnos={dayTurnos}
                    dayOff={dayOff}
                    servicios={servicios}
                    barbers={barbers}
                    colors={colors}
                    hourRails={hourRails}
                    halfHourRails={halfHourRails}
                    onTurnoClick={onTurnoClick}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
