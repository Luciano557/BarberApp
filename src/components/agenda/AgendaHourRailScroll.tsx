import { forwardRef, ReactNode } from 'react';
import { buildHourRails, MULTI_PX_PER_MIN, MULTI_RANGE_START, MULTI_RANGE_END } from './lib/multiDayLayout';

const TIME_RAIL_WIDTH = 56;

interface AgendaHourRailScrollProps {
  children: ReactNode;
  maxHeight: string;
}

export const AgendaHourRailScroll = forwardRef<HTMLDivElement, AgendaHourRailScrollProps>(
  function AgendaHourRailScroll({ children, maxHeight }, ref) {
    const hourRails = buildHourRails(MULTI_RANGE_START, MULTI_RANGE_END);
    const totalHeight = (MULTI_RANGE_END - MULTI_RANGE_START) * MULTI_PX_PER_MIN;

    return (
      <div ref={ref} className="overflow-y-auto overscroll-contain rounded-lg border" style={{ maxHeight }}>
        <div className="flex" style={{ height: totalHeight }}>
          {/* Time rail */}
          <div className="shrink-0 border-r relative bg-card" style={{ width: TIME_RAIL_WIDTH }}>
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

          {/* Day column */}
          <div className="grid flex-1 relative" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            {children}
          </div>
        </div>
      </div>
    );
  },
);
