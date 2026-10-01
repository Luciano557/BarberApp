import { useFinanceDemo } from '@/contexts/FinanceDemoContext';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Textarea } from '@/components/ui/textarea';
import { DrawerForm } from '@/components/ui/drawer-form';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { EmptySelectHint } from '@/components/agenda/EmptySelectHint';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RecordRow } from '@/components/ui/RecordRow';
import { MetricGroup } from '@/components/ui/MetricGroup';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, CalendarIcon, ChevronDown, ChevronRight, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { Barber } from '@/types/barbershop';
import { useSueldosData, type BarberSalaryData } from '@/hooks/useSueldosData';
import { isFinanceDemoActive, runFinanceWrite } from '@/lib/financeDemoRuntime';
import { toast } from 'sonner';
import { format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useRequirePinForAction } from '@/components/ActionPinGate';
import { useAuth } from '@/contexts/AuthContext';

const pagoSueldoSchema = z.object({
  barberoId: z.string().min(1, 'Seleccioná un empleado.'),
  monto: z.string().refine((v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0;
  }, 'Ingresá un monto válido.'),
  concepto: z.string().max(240, 'El concepto no puede superar los 240 caracteres.').optional().default(''),
});

type PagoSueldoFormValues = z.infer<typeof pagoSueldoSchema>;

const pagoSueldoDefaults: PagoSueldoFormValues = { barberoId: '', monto: '', concepto: '' };



interface SueldosPanelProps {
  barbers: Barber[];
}

// Subcomponent for expandable barber detail row
function BarberDetailRow({ 
  barber, 
  formatCurrency, 
  getSaldoBadge 
}: { 
  barber: BarberSalaryData; 
  formatCurrency: (amount: number) => string;
  getSaldoBadge: (saldo: number) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="rounded-lg border p-4 hover:bg-muted/50 cursor-pointer transition-colors">
          <RecordRow
            identity={
              <div className="flex flex-wrap items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <span className="font-medium">{barber.barberName}</span>
                <Badge variant={barber.compensationType === 'fijo' ? 'secondary' : 'outline'} className="text-xs">
                  {barber.compensationType === 'fijo' ? 'Fijo' : 'Comisión'}
                </Badge>
              </div>
            }
            metrics={
              <MetricGroup size="metric">
                <div>
                  <p className="text-xs text-muted-foreground">A pagar</p>
                  <p className="font-medium tabular-nums whitespace-nowrap">{formatCurrency(barber.totalDevengado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagado</p>
                  <p className="font-medium tabular-nums whitespace-nowrap text-status-success-foreground">{formatCurrency(barber.totalPagado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo (histórico)</p>
                  {getSaldoBadge(barber.saldo)}
                </div>
              </MetricGroup>
            }
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-8 pr-4 pb-4 space-y-4">
          {/* Fixed salary explanation */}
          {barber.fixedSalaryInfo && (
            <div className="p-3 rounded-md bg-accent/30 border border-accent/50 text-sm">
              <span className="font-medium">Sueldo fijo:</span> {formatCurrency(barber.fixedSalaryInfo.sueldoFijo)}/mes — {barber.fixedSalaryInfo.dias} días → {formatCurrency(barber.fixedSalaryInfo.devengado)} a pagar
            </div>
          )}
          {/* Comision extra por equipo */}
          {barber.comisionExtraEquipo && barber.comisionExtraEquipo.length > 0 && (
            <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-1">
              <span className="font-medium">Comisión extra por equipo</span>
              {barber.comisionExtraEquipo.map(ce => (
                <div key={ce.barberoOrigenId} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{ce.barberoOrigenNombre} ({ce.porcentajeActual}%)</span>
                  <span className="font-medium">{formatCurrency(ce.montoTotal)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 border-t border-primary/10 font-medium">
                <span>Total</span>
                <span>{formatCurrency(barber.comisionExtraEquipo.reduce((s, c) => s + c.montoTotal, 0))}</span>
              </div>
            </div>
          )}
          {/* Bono fijo */}
          {barber.bonoFijoOcurrencias && barber.bonoFijoOcurrencias.length > 0 && (
            <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-1">
              <span className="font-medium">Bono fijo</span>
              {barber.bonoFijoOcurrencias.map((o, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{format(new Date(o.fecha + 'T12:00:00'), "dd/MM", { locale: es })}</span>
                  <span className="font-medium">+{formatCurrency(o.monto)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 border-t border-primary/10 font-medium">
                <span>Total</span>
                <span>{formatCurrency(barber.bonoFijoTotal || 0)}</span>
              </div>
            </div>
          )}
          {/* Comisión por productos vendidos */}
          {barber.comisionProductosTotal != null && barber.comisionProductosTotal > 0 && (
            <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
              <div className="flex justify-between font-medium">
                <span>Comisión por productos vendidos</span>
                <span>{formatCurrency(barber.comisionProductosTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Calculada sobre la ganancia de los productos vendidos por este barbero.
              </p>
            </div>
          )}
          {/* Ingresos Detail — Tabla comparativa (Tipo B): compara efectivo/MP/facturado/comisión
              entre cierres, sin acción propia por fila (DESIGN.md → Registro vs. Tabla comparativa). */}
          {barber.detalleIngresos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Cierres de Caja</h4>
              <div className="rounded-md border">
                <Table comparative>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Fecha</TableHead>
                      <TableHead className="min-w-[100px]">Día</TableHead>
                      <TableHead className="text-right min-w-[130px]">Efectivo</TableHead>
                      <TableHead className="text-right min-w-[130px]">MP</TableHead>
                      <TableHead className="text-right min-w-[150px]">Total Facturado</TableHead>
                      <TableHead className="text-right min-w-[130px]">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {barber.detalleIngresos.map(ingreso => (
                      <TableRow key={ingreso.id}>
                        <TableCell className="whitespace-nowrap">{format(new Date(ingreso.fecha), "dd/MM/yyyy", { locale: es })}</TableCell>
                        <TableCell className="capitalize whitespace-nowrap">{ingreso.dia}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(ingreso.efectivo)}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(ingreso.mp)}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(ingreso.totalFacturado)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">{formatCurrency(ingreso.sueldo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Pagos Detail — Registro (Tipo A): cada fila es un pago independiente, mismo patrón
              que Historial de Pagos más abajo (DESIGN.md → Registro vs. Tabla comparativa). */}
          {barber.detallePagos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Pagos Realizados</h4>
              <div className="space-y-2">
                {barber.detallePagos.map(pago => (
                  <div key={pago.id} className="rounded-md border p-3">
                    <RecordRow
                      identity={
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{format(new Date(pago.fecha), "dd/MM/yyyy", { locale: es })}</p>
                          <p className="text-xs text-muted-foreground">{pago.concepto || '-'}</p>
                        </div>
                      }
                      metrics={
                        <MetricGroup size="metric">
                          <div>
                            <p className="text-xs text-muted-foreground">Monto</p>
                            <p className="font-medium tabular-nums whitespace-nowrap text-status-success-foreground">{formatCurrency(pago.monto)}</p>
                          </div>
                        </MetricGroup>
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {barber.detalleIngresos.length === 0 && barber.detallePagos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay registros en el período seleccionado
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SueldosPanel({ barbers }: SueldosPanelProps) {
  const demo = useFinanceDemo();
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  
  const requirePinForAction = useRequirePinForAction();
  const { isSucursalAccount } = useAuth();
  const [sueldosViewUnlocked, setSueldosViewUnlocked] = useState(false);
  const shouldGateSueldosView = isSucursalAccount && !sueldosViewUnlocked;

  const handleUnlockSueldosView = async () => {
    const gate = await requirePinForAction('ver_sueldos', currentSucursal?.id ?? null);
    if (!gate.ok || isFinanceDemoActive()) return;
    setSueldosViewUnlocked(true);
    if (isSucursalAccount && currentSucursal?.id) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await runFinanceWrite(async () => (supabase as any).rpc('notif_emit_view_event', {
          _module: 'sueldos',
          _sucursal_id: currentSucursal.id,
        }));
      } catch (e) { console.warn('[notif] view event error', e); }
    }
  };
  const [isPagoDrawerOpen, setIsPagoDrawerOpen] = useState(false);

  const pagoForm = useForm<PagoSueldoFormValues>({
    resolver: zodResolver(pagoSueldoSchema),
    defaultValues: pagoSueldoDefaults,
  });

  // Resync el formulario en cada apertura — antes se quedaba con los datos del pago anterior.
  useEffect(() => {
    if (isPagoDrawerOpen) {
      pagoForm.reset(pagoSueldoDefaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPagoDrawerOpen]);

  // Date filter for devengado: rango personalizado [start, end]
  const [periodStartDate, setPeriodStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [periodEndDate, setPeriodEndDate] = useState<Date | undefined>(undefined);
  const { salaryData, pagos, isLoading, hasLoadedOnce, fetchData } = useSueldosData(barbers, periodStartDate, periodEndDate);

  const onSubmitPago = async (values: PagoSueldoFormValues) => {
    if (!organization || isFinanceDemoActive()) return;

    const montoNum = parseFloat(values.monto);

    const barber = barbers.find(b => b.id === values.barberoId);
    if (!barber) {
      toast.error('Barbero no encontrado');
      return;
    }

    const gate = await requirePinForAction('registrar_pago_sueldo', currentSucursal?.id ?? null);
    if (!gate.ok || isFinanceDemoActive()) return;

    try {
      // Normalize name to avoid spacing issues
      const nombreNormalizado = `${barber.firstName.trim()} ${barber.lastName.trim()}`.replace(/\s+/g, ' ').trim();

      // 1. Insert pago_sueldos y obtener el id
      const { data: pagoInsertado, error } = await supabase
        .from('pagos_sueldos')
        .insert({
          barbero_id: values.barberoId,
          barbero_nombre: nombreNormalizado,
          monto: montoNum,
          concepto: values.concepto || null,
          organization_id: organization.id,
          sucursal_id: currentSucursal?.id || null,
        })
        .select('id, fecha')
        .single();

      if (error || !pagoInsertado) throw error ?? new Error('No se pudo registrar el pago');

      const pagoSueldoId = pagoInsertado.id as string;

      // 2. Generar egreso automático según modalidad del barbero
      const esFijo = barber.compensationType === 'fijo';
      const periodoRef = periodStartDate ?? new Date();
      const mesAnio = format(periodoRef, "MMMM yyyy", { locale: es });
      const fechaEgreso = (pagoInsertado.fecha as string) ?? new Date().toISOString();

      const categoriaEgreso = esFijo ? 'Sueldos fijos del personal' : 'Comisiones del personal';
      const tipoCostoEgreso: 'fijo' | 'variable' = esFijo ? 'fijo' : 'variable';
      const prefijo = esFijo ? 'Sueldo' : 'Comisión';
      const descripcionEgreso = `${prefijo} — ${nombreNormalizado} — ${mesAnio}`;

      const { error: egresoError } = await supabase.from('Egresos').insert({
        Fecha: fechaEgreso,
        Categoria: categoriaEgreso,
        Monto: montoNum,
        Descripcion: descripcionEgreso,
        tipo_costo: tipoCostoEgreso,
        pago_sueldo_id: pagoSueldoId,
        organization_id: organization.id,
        sucursal_id: currentSucursal?.id || null,
        estado: 'activo',
      });

      if (egresoError) {
        // Rollback: borrar el pago para que no quede huérfano
        await supabase.from('pagos_sueldos').delete().eq('id', pagoSueldoId);
        throw egresoError;
      }

      toast.success('Pago registrado correctamente');
      setIsPagoDrawerOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error registering payment:', error);
      toast.error('Error al registrar el pago');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getSaldoBadge = (saldo: number) => {
    if (saldo > 0) {
      return <StatusPill status="error" label={`Debe: ${formatCurrency(saldo)}`} className="whitespace-nowrap tabular-nums" />;
    } else if (saldo < 0) {
      return <StatusPill status="warning" label={`A favor: ${formatCurrency(Math.abs(saldo))}`} icon={false} className="whitespace-nowrap tabular-nums" />;
    } else {
      return <StatusPill status="neutral" label="Al día" />;
    }
  };

  // Primera carga real: sin datos utilizables todavía. Un refetch posterior
  // (cambio de período, pago registrado) ya tiene contenido en pantalla y no
  // vuelve a este estado — ver Silent-Refetch Rule en DESIGN.md → Loading.
  const skeletonDelayed = useDelayedVisible(isLoading);
  const showSkeleton = !hasLoadedOnce && skeletonDelayed;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sueldos"
        icon={Wallet}
        subtitle="Pagos al equipo, fijos y variables."
        className="pl-0"
        actions={(
          <Button disabled={demo.active} onClick={() => setIsPagoDrawerOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
        )}
      />

      {/* Filtros de período — fila propia, separada del header (Opción A) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant={!periodStartDate && !periodEndDate ? "default" : "outline"}
            size="sm"
            onClick={() => { setPeriodStartDate(undefined); setPeriodEndDate(undefined); }}
          >
            Todo
          </Button>
          <Button
            variant={
              !periodEndDate &&
              periodStartDate &&
              format(periodStartDate, 'yyyy-MM-dd') === format(startOfMonth(new Date()), 'yyyy-MM-dd')
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() => { setPeriodStartDate(startOfMonth(new Date())); setPeriodEndDate(undefined); }}
          >
            Este mes
          </Button>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "min-w-[180px] justify-start text-left font-normal",
                periodEndDate && "border-primary"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {periodStartDate && periodEndDate
                ? `${format(periodStartDate, "dd/MM/yyyy")} – ${format(periodEndDate, "dd/MM/yyyy")}`
                : 'Personalizado'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: periodStartDate, to: periodEndDate }}
              onSelect={(range) => {
                setPeriodStartDate(range?.from);
                setPeriodEndDate(range?.to);
              }}
              locale={es}
              numberOfMonths={2}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <DrawerForm
        open={isPagoDrawerOpen}
        onOpenChange={setIsPagoDrawerOpen}
        title="Registrar Pago de Sueldo"
        size="sm"
        isDirty={pagoForm.formState.isDirty}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPagoDrawerOpen(false)} disabled={pagoForm.formState.isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" form="pago-sueldo-form" disabled={demo.active || pagoForm.formState.isSubmitting || barbers.length === 0}>
              {pagoForm.formState.isSubmitting ? 'Registrando...' : 'Registrar Pago'}
            </Button>
          </div>
        }
      >
        <Form {...pagoForm}>
          <form id="pago-sueldo-form" onSubmit={pagoForm.handleSubmit(values => runFinanceWrite(() => onSubmitPago(values)).then(() => {}))} className="space-y-4">
            {barbers.length === 0 ? (
              <EmptySelectHint
                message="No hay empleados activos."
                ctaLabel="Añadir miembro del equipo"
                onCta={() => toast.message('Abrí Mi Negocio y entrá en Equipo para añadir o activar empleados.')}
              />
            ) : (
              <FormField
                control={pagoForm.control}
                name="barberoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empleado</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {barbers.map(barber => (
                          <SelectItem key={barber.id} value={barber.id}>
                            {barber.firstName} {barber.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={pagoForm.control}
              name="monto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <CurrencyInput placeholder="0" value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={pagoForm.control}
              name="concepto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Concepto (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      maxLength={240}
                      placeholder="Ej: Adelanto de sueldo, Pago quincenal..."
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground text-right">{(field.value ?? '').length}/240</p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </DrawerForm>

      {shouldGateSueldosView ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <p className="text-sm text-muted-foreground max-w-sm">
              El detalle de sueldos puede requerir autorización.
            </p>
            <Button onClick={handleUnlockSueldosView}>Ver sueldos</Button>
          </CardContent>
        </Card>
      ) : showSkeleton ? (
        <>
          {/* Summary Cards — skeleton */}
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map(i => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-7 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Resumen por Empleado — skeleton */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen por Empleado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-lg border p-4">
                  <SkeletonRow leading={false} lines={2} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Historial de Pagos — skeleton */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Pagos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[0, 1, 2].map(i => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  A pagar {periodStartDate && periodEndDate ? `(${format(periodStartDate, "dd/MM/yyyy")} – ${format(periodEndDate, "dd/MM/yyyy")})` : periodStartDate ? `(desde ${format(periodStartDate, "dd/MM/yyyy")})` : '(total)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(salaryData.reduce((acc, b) => acc + b.totalDevengado, 0))}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pagado {periodStartDate && periodEndDate ? `(${format(periodStartDate, "dd/MM/yyyy")} – ${format(periodEndDate, "dd/MM/yyyy")})` : periodStartDate ? `(desde ${format(periodStartDate, "dd/MM/yyyy")})` : '(total)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-status-success-foreground">
                  {formatCurrency(salaryData.reduce((acc, b) => acc + b.totalPagado, 0))}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Saldo Pendiente (histórico)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={cn(
                  "text-2xl font-bold",
                  salaryData.reduce((acc, b) => acc + b.saldo, 0) > 0 ? "text-destructive" : 
                  salaryData.reduce((acc, b) => acc + b.saldo, 0) < 0 ? "text-status-warning-foreground" : "text-muted-foreground"
                )}>
                  {formatCurrency(salaryData.reduce((acc, b) => acc + b.saldo, 0))}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Salary Table per Barber with expandable details */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen por Empleado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {salaryData.map(barber => (
                <BarberDetailRow 
                  key={barber.barberId} 
                  barber={barber} 
                  formatCurrency={formatCurrency}
                  getSaldoBadge={getSaldoBadge}
                />
              ))}
              {salaryData.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No hay datos de sueldos registrados
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment History — Registro (Tipo A): cada fila es un pago independiente
              (DESIGN.md → Registro vs. Tabla comparativa). */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Pagos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pagos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay pagos registrados</p>
              ) : (
                pagos.map(pago => (
                  <div key={pago.id} className="rounded-lg border p-4">
                    <RecordRow
                      identity={
                        <div className="min-w-0">
                          <p className="font-medium">{pago.barbero_nombre}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(pago.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                            {pago.concepto ? ` · ${pago.concepto}` : ''}
                          </p>
                        </div>
                      }
                      metrics={
                        <MetricGroup size="metric">
                          <div>
                            <p className="text-xs text-muted-foreground">Monto</p>
                            <p className="font-medium tabular-nums whitespace-nowrap text-status-success-foreground">{formatCurrency(pago.monto)}</p>
                          </div>
                        </MetricGroup>
                      }
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
