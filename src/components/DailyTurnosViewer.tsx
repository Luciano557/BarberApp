import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { format, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSucursal } from '@/contexts/SucursalContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTurnosRealtime } from '@/hooks/useTurnosRealtime';
import { Barber } from '@/types/barbershop';
import { useAgendaData, Turno } from './agenda/hooks/useAgendaData';
import { useBarberColors } from './agenda/hooks/useBarberColors';
import { buildHourRails, buildHalfHourRails, MULTI_PX_PER_MIN, MULTI_RANGE_START, MULTI_RANGE_END } from './agenda/lib/multiDayLayout';
import { AgendaHourRailScroll } from './agenda/AgendaHourRailScroll';
import { AgendaMultiDayColumn } from './agenda/AgendaMultiDayColumn';
import { AppointmentDetailDialog } from './agenda/AppointmentDetailDialog';
import { InlineReadError } from '@/components/ui/InlineReadError';

interface DailyTurnosViewerProps {
  barbers: Barber[];
}

export function DailyTurnosViewer({ barbers }: DailyTurnosViewerProps) {
  const { currentSucursal } = useSucursal();
  const { organization } = useOrganization();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [detailTurno, setDetailTurno] = useState<Turno | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);
  const isToday = isSameDay(currentDate, new Date());

  const { turnos, bloqueos, servicios, loading, phase, error, refetch, retry } = useAgendaData(
    currentSucursal?.id || '',
    organization?.id || '',
    currentDate,
    currentDate,
  );
  const loadFailed = phase === 'error';

  const showSkeleton = useDelayedVisible(loading);

  // Realtime: refetch silencioso de los turnos del día para esta sucursal.
  useTurnosRealtime({ sucursalId: currentSucursal?.id, onChange: refetch });

  const colors = useBarberColors(barbers.map(b => b.id));

  const hourRails = useMemo(() => buildHourRails(MULTI_RANGE_START, MULTI_RANGE_END), []);
  const halfHourRails = useMemo(() => buildHalfHourRails(MULTI_RANGE_START, MULTI_RANGE_END), []);

  const dayOff = bloqueos.find(b =>
    b.barbero_id === null && b.todo_el_dia && b.fecha_inicio <= dateStr && b.fecha_fin >= dateStr,
  );

  // Al entrar a "hoy", centrar el scroll en la hora actual en vez de arrancar en las 08:00.
  useEffect(() => {
    if (loading || !isToday || !scrollRef.current) return;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const clamped = Math.min(Math.max(nowMinutes, MULTI_RANGE_START), MULTI_RANGE_END);
    const targetTop = (clamped - MULTI_RANGE_START) * MULTI_PX_PER_MIN;
    const container = scrollRef.current;
    container.scrollTop = Math.max(0, targetTop - container.clientHeight / 2);
  }, [loading, isToday, dateStr]);

  if (!currentSucursal) return null;

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Header with navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(prev => addDays(prev, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium capitalize">
                {format(currentDate, "EEEE dd 'de' MMMM", { locale: es })}
              </span>
              {isToday && <Badge variant="default" className="text-[10px] h-4 px-1.5">Hoy</Badge>}
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(prev => addDays(prev, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Vista de agenda del día */}
          {loading ? (
            showSkeleton ? (
              <div className="space-y-2 py-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3" style={{ paddingLeft: `${i * 14}%` }}>
                    <Skeleton className="h-3 w-10 shrink-0" />
                    <Skeleton className="h-9 flex-1 max-w-[220px] rounded-md" />
                  </div>
                ))}
              </div>
            ) : null
          ) : loadFailed ? (
            <InlineReadError
              message={error ?? 'No pudimos cargar los turnos del día.'}
              onRetry={retry}
              bordered={false}
            />
          ) : (
            <AgendaHourRailScroll ref={scrollRef} maxHeight="360px">
              <AgendaMultiDayColumn
                isToday={isToday}
                dayTurnos={turnos}
                dayOff={dayOff}
                servicios={servicios}
                barbers={barbers}
                colors={colors}
                hourRails={hourRails}
                halfHourRails={halfHourRails}
                onTurnoClick={setDetailTurno}
              />
            </AgendaHourRailScroll>
          )}
        </CardContent>
      </Card>

      {organization?.id && (
        <AppointmentDetailDialog
          open={!!detailTurno}
          onOpenChange={(v) => { if (!v) setDetailTurno(null); }}
          turno={detailTurno}
          organizationId={organization.id}
          sucursalId={currentSucursal.id}
          barbers={barbers}
          servicios={servicios}
          onChanged={refetch}
          readOnly
        />
      )}
    </>
  );
}
