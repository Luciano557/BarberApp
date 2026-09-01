import { cn } from '@/lib/utils';
import { Barber } from '@/types/barbershop';
import { Turno, Bloqueo, Servicio } from './hooks/useAgendaData';
import { timeToMinutes } from './lib/timeUtils';
import { MULTI_PX_PER_MIN, MULTI_RANGE_START, computeLayouts } from './lib/multiDayLayout';
import { AgendaMultiDayTurnoCard } from './AgendaMultiDayTurnoCard';

interface AgendaMultiDayColumnProps {
  isToday: boolean;
  dayTurnos: Turno[];
  dayOff: Bloqueo | undefined;
  servicios: Servicio[];
  barbers: Barber[];
  colors: Record<string, string>;
  hourRails: number[];
  halfHourRails: number[];
  onTurnoClick: (t: Turno) => void;
}

export function AgendaMultiDayColumn({
  isToday,
  dayTurnos,
  dayOff,
  servicios,
  barbers,
  colors,
  hourRails,
  halfHourRails,
  onTurnoClick,
}: AgendaMultiDayColumnProps) {
  const layouts = computeLayouts(dayTurnos);

  return (
    <div className={cn('border-r relative', isToday && 'bg-primary/5')}>
      {/* Hour lines */}
      {hourRails.slice(0, -1).map((m) => (
        <div
          key={m}
          className="absolute left-0 right-0 border-t border-border/40 pointer-events-none"
          style={{ top: (m - MULTI_RANGE_START) * MULTI_PX_PER_MIN }}
        />
      ))}

      {/* Half-hour dashed lines */}
      {halfHourRails.map((m) => (
        <div
          key={`half-${m}`}
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: (m - MULTI_RANGE_START) * MULTI_PX_PER_MIN,
            borderTop: '1px dashed hsl(var(--border))',
          }}
        />
      ))}

      {/* Appointment cards */}
      {dayTurnos.map(t => {
        const top = (timeToMinutes(t.hora_inicio) - MULTI_RANGE_START) * MULTI_PX_PER_MIN;
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
          <AgendaMultiDayTurnoCard
            key={t.id}
            horaInicio={t.hora_inicio}
            clienteNombre={t.cliente_nombre}
            isPending={isPending}
            top={top}
            height={height}
            leftPct={leftPct}
            widthPct={widthPct}
            borderColor={borderColor}
            servicioNombre={servicio?.nombre}
            barberName={barberName}
            eligioBarbero={t.eligio_barbero}
            indicatorColor={colors[t.barbero_id] ?? 'hsl(var(--primary))'}
            onClick={() => onTurnoClick(t)}
          />
        );
      })}

      {/* Day-off overlay */}
      {dayOff && (
        <div className="absolute inset-0 bg-muted/70 flex items-center justify-center z-[10]">
          <span className="text-[10px] text-muted-foreground">Cerrado</span>
        </div>
      )}
    </div>
  );
}
