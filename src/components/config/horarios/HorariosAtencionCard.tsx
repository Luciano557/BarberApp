import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CatalogSectionCard } from '@/components/ui/CatalogSectionCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { DrawerForm } from '@/components/ui/drawer-form';
import { StatusPill } from '@/components/ui/StatusPill';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptySelectHint } from '@/components/agenda/EmptySelectHint';
import { Barber } from '@/types/barbershop';
import { cn } from '@/lib/utils';
import { ScheduleEditor } from './ScheduleEditor';
import { ScheduleSummary } from './ScheduleSummary';
import { useHorariosTrabajo } from './useHorariosTrabajo';

interface HorariosAtencionCardProps {
  sucursalId: string;
  organizationId: string;
  /** Barberos de esta sucursal (se filtran los activos acá adentro). */
  barbers: Barber[];
  /**
   * Cambia de valor cada vez que se navega hacia esta sección desde Turnos
   * estando ya en Mi Negocio. Dispara scroll + resalte.
   */
  highlightNonce?: number;
}

/** Marco de lectura del resumen — mismo tratamiento en ambas pestañas. */
function SummaryFrame({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-muted/20 p-4',
        muted ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {children}
    </div>
  );
}

export function HorariosAtencionCard({
  sucursalId, organizationId, barbers, highlightNonce,
}: HorariosAtencionCardProps) {
  const {
    loading, sucursalHorarios, horariosDeBarbero, barbersWithOverride,
    createOverride, removeOverride, refetch,
  } = useHorariosTrabajo(sucursalId, organizationId);
  const showSkeleton = useDelayedVisible(loading);

  const [activeView, setActiveView] = useState<'sucursal' | 'barberos'>('sucursal');
  const [selectedBarberId, setSelectedBarberId] = useState('');
  /** `null` = editando el horario de sucursal · string = override del barbero · `undefined` = panel cerrado. */
  const [editorBarberoId, setEditorBarberoId] = useState<string | null | undefined>(undefined);

  const [highlighted, setHighlighted] = useState(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Llegada desde Turnos: por localStorage (cambio de pestaña) o por nonce
  // (ya estábamos en Mi Negocio y el handle imperativo pidió el scroll).
  useEffect(() => {
    if (!organizationId) return;
    const flagKey = `vittro:miNegocio:highlightHorarios:${organizationId}`;
    let stored: string | null = null;
    try { stored = localStorage.getItem(flagKey); } catch { /* ignore */ }
    // El flag guarda la sucursal que disparó la navegación: solo la consume la
    // ficha correcta, para que otra no se quede con el resalte ajeno.
    const flagEsParaEstaSucursal = stored === sucursalId;
    if (!flagEsParaEstaSucursal && !highlightNonce) return;
    if (flagEsParaEstaSucursal) {
      try { localStorage.removeItem(flagKey); } catch { /* ignore */ }
    }

    setHighlighted(true);
    // La ficha acaba de montar con animate-fade-in; scrollear en el mismo tick
    // apunta a una posición que todavía se está acomodando.
    const scrollTimeout = setTimeout(() => {
      document
        .querySelector('[data-onboarding-id="horarios-atencion-card"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);

    highlightTimeoutRef.current = setTimeout(() => setHighlighted(false), 2200);
    return () => {
      clearTimeout(scrollTimeout);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [organizationId, sucursalId, highlightNonce]);

  const activeBarbers = barbers.filter(b => b.active);
  const selectedBarberHorarios = selectedBarberId ? horariosDeBarbero(selectedBarberId) : [];
  const barberHasOverride = selectedBarberId ? barbersWithOverride.has(selectedBarberId) : false;
  const sucursalTieneHorario = sucursalHorarios.length > 0;

  const scrollToEquipo = () => {
    document
      .querySelector('[data-onboarding-id="equipo-section"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const editorHorarios = editorBarberoId ? horariosDeBarbero(editorBarberoId) : sucursalHorarios;
  const editorTitle = editorBarberoId
    ? `Horario de ${activeBarbers.find(b => b.id === editorBarberoId)?.firstName ?? 'barbero'}`
    : 'Horario de atención de la sucursal';

  return (
    <>
      <CatalogSectionCard
        icon={Clock}
        title="Horarios de atención"
        description="Horario de atención de la sucursal y de cada barbero del equipo."
        className={cn('transition-shadow duration-highlight', highlighted && 'ring-2 ring-primary/40')}
      >
        {loading ? (
          showSkeleton ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-56 sm:max-w-xs" />
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </div>
          ) : null
        ) : (
          <div className="w-full">
            <SegmentedControl
              ariaLabel="Alcance del horario"
              className="sm:max-w-xs"
              options={[
                { value: 'sucursal', label: 'Sucursal' },
                { value: 'barberos', label: 'Barberos' },
              ]}
              value={activeView}
              onChange={(v) => setActiveView(v as 'sucursal' | 'barberos')}
            />

            {/* ---------- Sucursal ---------- */}
            {activeView === 'sucursal' && (
            <div role="tabpanel" aria-label="Horario de la sucursal" className="mt-4 space-y-4">
              {sucursalTieneHorario ? (
                <>
                  <SummaryFrame>
                    <ScheduleSummary
                      horarios={sucursalHorarios}
                      emptyLabel="Todos los días están pausados."
                    />
                  </SummaryFrame>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Los barberos sin horario propio usan este horario.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setEditorBarberoId(null)}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar horario
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3 rounded-lg border border-dashed border-border p-6 text-center">
                  <Clock className="mx-auto h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm text-foreground">Todavía no cargaste el horario de atención</p>
                    <p className="text-xs text-muted-foreground">
                      Los barberos sin horario propio van a usar este horario.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditorBarberoId(null)}>
                    <Plus className="h-4 w-4 mr-1" /> Cargar horario
                  </Button>
                </div>
              )}
            </div>
            )}

            {/* ---------- Barberos ---------- */}
            {activeView === 'barberos' && (
            <div role="tabpanel" aria-label="Horarios de barberos" className="mt-4 space-y-4">
              {activeBarbers.length === 0 ? (
                <EmptySelectHint
                  message="No hay barberos activos en esta sucursal."
                  ctaLabel="Ir a Equipo"
                  onCta={scrollToEquipo}
                />
              ) : (
                <>
                  <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
                    <SelectTrigger className="h-9 text-sm sm:max-w-xs">
                      <SelectValue placeholder="Seleccionar barbero" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeBarbers.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          <div className="flex items-center gap-2">
                            <span>{b.firstName} {b.lastName}</span>
                            {barbersWithOverride.has(b.id) ? (
                              <StatusPill status="success" label="Horario propio" size="sm" />
                            ) : (
                              <StatusPill status="neutral" label="Usa sucursal" size="sm" />
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!selectedBarberId && (
                    <p className="text-xs text-muted-foreground">
                      Elegí un barbero para ver o editar su horario.
                    </p>
                  )}

                  {selectedBarberId && !barberHasOverride && (
                    <div className="space-y-3">
                      <SummaryFrame muted>
                        <ScheduleSummary
                          horarios={sucursalHorarios}
                          emptyLabel="La sucursal todavía no tiene horario de atención cargado."
                        />
                      </SummaryFrame>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          Este barbero usa el horario de la sucursal.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => createOverride(selectedBarberId)}>
                          <Plus className="h-4 w-4 mr-1" /> Crear horario propio
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedBarberId && barberHasOverride && (
                    <div className="space-y-3">
                      <SummaryFrame>
                        <ScheduleSummary
                          horarios={selectedBarberHorarios}
                          emptyLabel="Todos los días están pausados."
                        />
                      </SummaryFrame>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => removeOverride(selectedBarberId)}
                        >
                          <ArrowLeft className="h-4 w-4 mr-1" /> Volver al horario de la sucursal
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditorBarberoId(selectedBarberId)}>
                          <Pencil className="h-4 w-4 mr-1" /> Editar horario
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            )}
          </div>
        )}
      </CatalogSectionCard>

      <DrawerForm
        open={editorBarberoId !== undefined}
        onOpenChange={(o) => { if (!o) setEditorBarberoId(undefined); }}
        title={editorTitle}
        size="lg"
        footer={
          <div className="flex w-full justify-end">
            <Button variant="outline" onClick={() => setEditorBarberoId(undefined)}>Listo</Button>
          </div>
        }
      >
        <ScheduleEditor
          horarios={editorHorarios}
          sucursalId={sucursalId}
          organizationId={organizationId}
          barberoId={editorBarberoId ?? null}
          onRefresh={refetch}
        />
      </DrawerForm>
    </>
  );
}
