import { cn } from '@/lib/utils';
import { formatHHMM } from './lib/timeUtils';

interface AgendaMultiDayTurnoCardProps {
  horaInicio: string;
  clienteNombre: string | null;
  isPending: boolean;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  borderColor: string;
  servicioNombre: string | undefined;
  barberName: string | null;
  eligioBarbero: boolean;
  indicatorColor: string;
  onClick: () => void;
}

export function AgendaMultiDayTurnoCard({
  horaInicio,
  clienteNombre,
  isPending,
  top,
  height,
  leftPct,
  widthPct,
  borderColor,
  servicioNombre,
  barberName,
  eligioBarbero,
  indicatorColor,
  onClick,
}: AgendaMultiDayTurnoCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute rounded-md py-1 px-1.5 overflow-hidden bg-card select-none cursor-pointer hover:shadow-sm transition duration-150 ease-out active:scale-[0.97] z-20 text-left',
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
      <div className="text-[10px] font-mono text-muted-foreground leading-tight">
        {formatHHMM(horaInicio)}
      </div>
      <div className="text-[11px] font-semibold text-foreground truncate leading-tight">
        {clienteNombre || 'Sin nombre'}
      </div>
      {height >= 46 && (
        <div className="text-[10px] text-muted-foreground truncate leading-tight">
          {servicioNombre}
        </div>
      )}
      {height >= 60 && barberName && (
        <div className="text-[10px] text-muted-foreground truncate leading-tight">
          {barberName}
        </div>
      )}
      {eligioBarbero && (
        <div
          title="Eligió barbero específico"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: indicatorColor,
            boxShadow: '0 0 0 2px hsl(var(--card))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            zIndex: 2,
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <circle cx="4" cy="2.5" r="1.5" fill="white"/>
            <path d="M1 7c0-1.657 1.343-3 3-3s3 1.343 3 3" stroke="white" strokeWidth="1"/>
          </svg>
        </div>
      )}
    </button>
  );
}
