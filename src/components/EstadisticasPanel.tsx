import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, Scissors, Calendar, Target,
  PiggyBank, Receipt, BarChart3, Percent,
  Clock, Trophy, DollarSign, TrendingUp, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays, min, addDays } from 'date-fns';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { MetricCard } from './estadisticas/MetricCard';
import { MetricDetailDialog } from './estadisticas/MetricDetailDialog';
import { useEstadisticasData } from './estadisticas/useEstadisticasData';
import { useOcupacionResumen } from './estadisticas/useOcupacionResumen';
import { calcVariation } from './estadisticas/dateHelpers';
import { DerivedMonthlyMetrics, MetricCardDef } from './estadisticas/types';

export function EstadisticasPanel() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [periodoMeses, setPeriodoMeses] = useState('6');
  const [capacidadDiaria, setCapacidadDiaria] = useState(18);
  const [selectedMetric, setSelectedMetric] = useState<MetricCardDef | null>(null);

  const { monthlyData, isLoading, ventasData, ingresosRaw } = useEstadisticasData(
    organization?.id,
    currentSucursal,
    periodoMeses,
    capacidadDiaria,
  );

  const {
    ocupacionPorMes, avgDuracionMin, coberturaIncompleta, isLoading: isLoadingOcupacion,
  } = useOcupacionResumen(organization?.id, currentSucursal, periodoMeses);

  // Fetch capacidad_diaria from DB when sucursal changes
  useEffect(() => {
    const fetchCapacidad = async () => {
      if (!currentSucursal?.id || !organization?.id) {
        setCapacidadDiaria(18);
        return;
      }
      const { data } = await supabase
        .from('sucursal_settings')
        .select('capacidad_diaria')
        .eq('sucursal_id', currentSucursal.id)
        .maybeSingle();
      setCapacidadDiaria(data?.capacidad_diaria ?? 18);
    };
    fetchCapacidad();
  }, [currentSucursal?.id, organization?.id]);

  const saveCapacidadDiaria = async (value: number) => {
    if (!currentSucursal?.id || !organization?.id) return;
    await supabase
      .from('sucursal_settings')
      .upsert(
        { sucursal_id: currentSucursal.id, organization_id: organization.id, capacidad_diaria: value },
        { onConflict: 'sucursal_id' }
      );
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const formatCurrencyShort = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value.toFixed(0)}`;
  };

  // Derive per-month metrics with variation
  const derivedMetrics: DerivedMonthlyMetrics[] = (() => {
    const today = new Date();
    const currentMonthStr = format(today, 'yyyy-MM');
    const diaActual = today.getDate();
    const ocupacionByMonth = new Map(ocupacionPorMes.map(o => [o.month, o]));

    const raw = monthlyData.map(m => {
      const ticketPromedio = m.servicios > 0 ? m.facturacion / m.servicios : 0;
      const gananciaNeta = m.facturacion - m.totalEgresos;
      const rentabilidad = m.facturacion > 0 ? (gananciaNeta / m.facturacion) * 100 : 0;
      const costoFijoPorServicio = m.servicios > 0 ? m.costosFijos / m.servicios : 0;
      const costoVariablePorServicio = m.servicios > 0 ? m.costosVariables / m.servicios : 0;
      const gananciaPorServicio = ticketPromedio - costoFijoPorServicio - costoVariablePorServicio;
      const puntoEquilibrio = gananciaPorServicio > 0 ? Math.ceil(m.costosFijos / gananciaPorServicio) : 0;

      // Ocupación: horas de servicio vendidas (estimadas con la duración promedio del catálogo
      // activo) ÷ (barberos activos con rol barbero × horario general de la sucursal ese día).
      // No mira horario individual ni bloqueos puntuales. Ver useOcupacionResumen.ts.
      const horasVendidas = (m.servicios * avgDuracionMin) / 60;
      const horasDisponibles = ocupacionByMonth.get(m.month)?.horasDisponibles ?? 0;
      const tasaOcupacion = horasDisponibles > 0 ? (horasVendidas / horasDisponibles) * 100 : 0;

      return {
        monthLabel: m.monthLabel,
        facturacion: m.facturacion,
        servicios: m.servicios,
        efectivo: m.efectivo,
        mp: m.mp,
        costosFijos: m.costosFijos,
        rentabilidad,
        ticketPromedio,
        costoFijoPorServicio,
        costoVariablePorServicio,
        gananciaPorServicio,
        puntoEquilibrio,
        tasaOcupacion,
      };
    });

    // Calculate variations
    return raw.map((curr, i): DerivedMonthlyMetrics => {
      const prev = i > 0 ? raw[i - 1] : null;
      const m = monthlyData[i];
      const prevM = i > 0 ? monthlyData[i - 1] : null;
      const isCurrentMonth = m.month === currentMonthStr;

      // For the current month, use partial previous month data (same first N days) for cumulative metrics
      const useSameDayComparison = isCurrentMonth && prevM && prevM.parcialFacturacion !== undefined;

      const prevFacturacion = useSameDayComparison ? prevM!.parcialFacturacion! : prev?.facturacion ?? 0;
      const prevServicios = useSameDayComparison ? prevM!.parcialServicios! : prev?.servicios ?? 0;
      const prevEfectivo = useSameDayComparison ? prevM!.parcialEfectivo! : prev?.efectivo ?? 0;
      const prevMp = useSameDayComparison ? prevM!.parcialMp! : prev?.mp ?? 0;
      const prevCostosFijos = useSameDayComparison ? prevM!.parcialCostosFijos! : prev?.costosFijos ?? 0;

      // Ocupación parcial del mes anterior (mismos primeros N días), para comparar mes en curso vs
      // mes anterior en igualdad de condiciones — misma lógica que las demás métricas "parciales".
      const prevOcupacionMes = prevM ? ocupacionByMonth.get(prevM.month) : undefined;
      const prevHorasDisponiblesParciales = prevOcupacionMes?.horasDisponiblesParciales;
      const prevHorasVendidasParciales = prevM?.parcialServicios !== undefined
        ? (prevM.parcialServicios * avgDuracionMin) / 60
        : undefined;
      const prevTasaOcupacionParcial = (useSameDayComparison && prevHorasDisponiblesParciales !== undefined && prevHorasVendidasParciales !== undefined)
        ? (prevHorasDisponiblesParciales > 0 ? (prevHorasVendidasParciales / prevHorasDisponiblesParciales) * 100 : 0)
        : undefined;

      return {
        ...curr,
        isCurrentMonth,
        diasTranscurridos: isCurrentMonth ? diaActual : undefined,
        facturacionVar: prev ? calcVariation(curr.facturacion, prevFacturacion) : null,
        serviciosVar: prev ? calcVariation(curr.servicios, prevServicios) : null,
        efectivoVar: prev ? calcVariation(curr.efectivo, prevEfectivo) : null,
        mpVar: prev ? calcVariation(curr.mp, prevMp) : null,
        costosFijosVar: prev ? calcVariation(curr.costosFijos, prevCostosFijos) : null,
        // Non-cumulative metrics: compare directly as before
        rentabilidadVar: prev ? calcVariation(curr.rentabilidad, prev.rentabilidad) : null,
        ticketPromedioVar: prev ? calcVariation(curr.ticketPromedio, prev.ticketPromedio) : null,
        costoFijoPorServicioVar: prev ? calcVariation(curr.costoFijoPorServicio, prev.costoFijoPorServicio) : null,
        costoVariablePorServicioVar: prev ? calcVariation(curr.costoVariablePorServicio, prev.costoVariablePorServicio) : null,
        gananciaPorServicioVar: prev ? calcVariation(curr.gananciaPorServicio, prev.gananciaPorServicio) : null,
        puntoEquilibrioVar: prev ? calcVariation(curr.puntoEquilibrio, prev.puntoEquilibrio) : null,
        tasaOcupacionVar: prev ? calcVariation(curr.tasaOcupacion, prevTasaOcupacionParcial !== undefined ? prevTasaOcupacionParcial : prev.tasaOcupacion) : null,
      };
    });
  })();

  // Latest month values for headline
  const latest = derivedMetrics.length > 0 ? derivedMetrics[derivedMetrics.length - 1] : null;

  const serviciosCard: MetricCardDef = {
    title: 'Servicios',
    dataKey: 'servicios',
    icon: Scissors,
    color: 'text-primary',
    chartColor: 'hsl(var(--primary))',
    formatFn: (v) => `${v} servicios`,
    shortFormatFn: (v) => `${v}`,
    description: 'Cantidad de servicios realizados por mes.',
  };

  // Facturación, Ticket Promedio, Rentabilidad y Punto de Equilibrio viven ahora en la Sección
  // Resumen (más abajo). Estas dos quedan en su grupo actual hasta que Build 2 (Plata real) las
  // reubique — no se tocan por fuera de lo pedido en este build.
  const ingresosCards: MetricCardDef[] = [
    {
      title: 'Efectivo',
      dataKey: 'efectivo',
      icon: DollarSign,
      color: 'text-status-success-foreground',
      chartColor: 'hsl(var(--chart-cash))',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Ingresos mensuales cobrados en efectivo.',
    },
    {
      title: 'Mercado Pago',
      dataKey: 'mp',
      icon: DollarSign,
      color: 'text-status-info-foreground',
      chartColor: 'hsl(var(--chart-mp))',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Ingresos mensuales cobrados por Mercado Pago.',
    },
  ];

  // Rentabilidad y Punto de Equilibrio viven ahora en Resumen (más abajo); estas 4 quedan en su
  // grupo actual hasta Build 2, sin tocarlas por fuera de lo pedido en este build.
  const costosCards: MetricCardDef[] = [
    {
      title: 'Costos Fijos',
      dataKey: 'costosFijos',
      icon: PiggyBank,
      color: 'text-status-error-foreground',
      chartColor: 'hsl(var(--chart-cost))',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Gastos mensuales independientes de la cantidad de clientes.',
    },
    {
      title: 'Costo Fijo por Servicio',
      dataKey: 'costoFijoPorServicio',
      icon: BarChart3,
      color: 'text-chart-orange',
      chartColor: 'hsl(var(--chart-orange))',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Cuánto te cuesta cada cliente solo en costos fijos.',
    },
    {
      title: 'Costo Variable por Servicio',
      dataKey: 'costoVariablePorServicio',
      icon: Scissors,
      color: 'text-chart-amber',
      chartColor: 'hsl(var(--chart-amber))',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Lo que gastás por cada cliente en insumos y comisiones.',
    },
    {
      title: 'Ganancia por Servicio',
      dataKey: 'gananciaPorServicio',
      icon: TrendingUp,
      color: latest && latest.gananciaPorServicio >= 0 ? 'text-status-success-foreground' : 'text-status-error-foreground',
      chartColor: 'hsl(var(--chart-cash))',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Cuánto ganás realmente por cada cliente después de costos.',
    },
  ];

  // ---- Sección 1: Resumen ----
  const resumenCards: MetricCardDef[] = [
    {
      title: 'Facturación',
      dataKey: 'facturacion',
      icon: DollarSign,
      color: 'text-status-success-foreground',
      chartColor: 'hsl(var(--chart-cash))',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Cuánto dinero entró al negocio cada mes.',
    },
    {
      title: 'Ticket Promedio',
      dataKey: 'ticketPromedio',
      icon: Receipt,
      color: 'text-status-info-foreground',
      chartColor: 'hsl(var(--chart-mp))',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Cuánto gasta cada cliente en promedio por visita.',
    },
    {
      title: 'Rentabilidad',
      dataKey: 'rentabilidad',
      icon: Percent,
      color: latest && latest.rentabilidad >= 0 ? 'text-status-success-foreground' : 'text-status-error-foreground',
      chartColor: 'hsl(var(--chart-cash))',
      formatFn: (v) => `${v.toFixed(1)}%`,
      shortFormatFn: (v) => `${v.toFixed(0)}%`,
      description: 'Porcentaje de lo facturado que queda como ganancia real.',
    },
    {
      title: 'Punto de Equilibrio',
      dataKey: 'puntoEquilibrio',
      icon: Target,
      color: 'text-status-purple-foreground',
      chartColor: 'hsl(var(--chart-purple))',
      formatFn: (v) => `${v} clientes`,
      shortFormatFn: (v) => `${v}`,
      description: 'Clientes necesarios para cubrir todos los costos fijos.',
    },
  ];

  // ---- Comportamiento del Cliente ----
  const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const DAY_NAMES_FULL = ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'];

  const behaviorData = useMemo(() => {
    const hasIngresos = ingresosRaw.length > 0;
    const hasVentas = ventasData.length > 0;
    if (!hasIngresos && !hasVentas) return { byDay: [], byHour: [], peakSlots: [] };

    const tz = organization?.timezone || 'America/Argentina/Buenos_Aires';
    const meses = parseInt(periodoMeses);
    const endDateRaw = endOfMonth(new Date());
    const startDate = startOfMonth(subMonths(new Date(), meses - 1));
    const today = new Date();
    const effectiveEnd = min([endDateRaw, today]);
    const totalDays = Math.max(1, differenceInDays(effectiveEnd, startDate) + 1);

    // Contar cuántas veces aparece cada día de semana en el rango real
    const actualOccurrences: number[] = Array(7).fill(0);
    let cursor = new Date(startDate);
    while (cursor <= effectiveEnd) {
      actualOccurrences[cursor.getDay()]++;
      cursor = addDays(cursor, 1);
    }

    // === Ventas por día de semana: usar columna `dia` de INGRESOS ===
    // Mapa de nombre español a índice JS (getDay(): 0=dom, 1=lun, ...)
    const diaNameToIndex: Record<string, number> = {
      'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3,
      'jueves': 4, 'viernes': 5, 'sábado': 6,
    };

    const dayCounts: number[] = Array(7).fill(0);
    ingresosRaw.forEach(i => {
      if (!i.dia) return;
      const dayIdx = diaNameToIndex[i.dia.toLowerCase()];
      if (dayIdx === undefined) return;
      dayCounts[dayIdx] += i.cantidad_de_servicios;
    });

    // Reorder: Lun-Dom
    const dayOrder = [1, 2, 3, 4, 5, 6, 0];
    const byDay = dayOrder.map(d => ({
      name: DAY_NAMES[d],
      ventas: actualOccurrences[d] > 0 ? Math.round((dayCounts[d] / actualOccurrences[d]) * 10) / 10 : 0,
    }));

    // === Ventas por hora: usar VENTA (tickets con hora exacta) ===
    const hourCounts: number[] = Array(24).fill(0);
    const dayHourCounts: Record<string, number> = {};

    ventasData.forEach(v => {
      try {
        const localStr = new Date(v.fecha_hora).toLocaleString('en-US', { timeZone: tz });
        const local = new Date(localStr);
        const hour = local.getHours();
        hourCounts[hour]++;
        const day = local.getDay();
        const key = `${day}-${hour}`;
        dayHourCounts[key] = (dayHourCounts[key] || 0) + 1;
      } catch {}
    });

    const byHour = hourCounts
      .map((count, hour) => ({ name: `${hour}hs`, ventas: Math.round((count / totalDays) * 10) / 10, hour, raw: count }))
      .filter(h => h.raw > 0);

    // Top 3 peak slots
    const peakSlots = Object.entries(dayHourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, count]) => {
        const [d, h] = key.split('-').map(Number);
        return { label: `${DAY_NAMES_FULL[d]} a las ${h}hs`, count };
      });

    return { byDay, byHour, peakSlots };
  }, [ventasData, ingresosRaw, organization?.timezone, periodoMeses]);

  const behaviorChartConfig = {
    ventas: { label: "Ventas promedio", color: "hsl(var(--primary))" },
  };

  const behaviorSection = (ingresosRaw.length > 0 || ventasData.length > 0) ? (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">👥 Comportamiento del Cliente</h2>
        <p className="text-sm text-muted-foreground">Patrones de demanda por día y horario para optimizar tu operación.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ventas por día de semana */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Ventas por día de semana</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Promedio de servicios por día, basado en cierres de caja.</p>
            </div>
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <ChartContainer config={behaviorChartConfig} className="h-48 w-full">
              <ComposedChart data={behaviorData.byDay} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={35} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value, name, item) => `${value} ventas promedio cada ${DAY_NAMES_FULL[([1,2,3,4,5,6,0])[behaviorData.byDay.findIndex(d => d.name === item?.payload?.name)] ?? 0]}`} />} />
                <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} isAnimationActive={!prefersReducedMotion} />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Ventas por hora del día */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Ventas por hora del día</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Distribución horaria promedio. Basado en cobros en tiempo real.</p>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <ChartContainer config={behaviorChartConfig} className="h-48 w-full">
              <ComposedChart data={behaviorData.byHour} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={35} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value} ventas promedio diarias`} />} />
                <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} isAnimationActive={!prefersReducedMotion} />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Horarios pico */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Horarios Pico</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Los 3 momentos de mayor demanda. Basado en cobros en tiempo real.</p>
            </div>
            <Trophy className="h-4 w-4 text-status-warning-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            {behaviorData.peakSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {behaviorData.peakSlots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      i === 0 ? 'bg-status-warning-bg text-status-warning-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      #{i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{slot.label}</p>
                      <p className="text-xs text-muted-foreground">{slot.count} ventas en el período</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  ) : null;

  const ocupacionMetricDef: MetricCardDef = {
    title: 'Tasa de Ocupación',
    dataKey: 'tasaOcupacion',
    icon: Users,
    color: 'text-status-indigo-foreground',
    chartColor: 'hsl(var(--chart-indigo))',
    formatFn: (v) => `${v.toFixed(1)}%`,
    shortFormatFn: (v) => `${v.toFixed(0)}%`,
    description: 'Horas de servicio vendidas sobre horas-silla disponibles del local (estimado).',
  };

  if (isLoading || isLoadingOcupacion) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2"><div className="h-4 bg-muted rounded w-24" /></CardHeader>
              <CardContent><div className="h-32 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 justify-end">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select value={periodoMeses} onValueChange={setPeriodoMeses}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Último año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sección 1: Resumen */}
      <div className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumen</h2>

        {/* Servicios - full width first */}
        <MetricCard
          metric={serviciosCard}
          data={derivedMetrics}
          latest={latest}
          onSelect={setSelectedMetric}
          className="md:col-span-2"
          chartSize="lg"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resumenCards.map((metric) => (
            <MetricCard key={metric.dataKey} metric={metric} data={derivedMetrics} latest={latest} onSelect={setSelectedMetric} />
          ))}

          <MetricCard
            metric={ocupacionMetricDef}
            data={derivedMetrics}
            latest={latest}
            onSelect={setSelectedMetric}
            banner={coberturaIncompleta ? (
              <div
                className="mb-3 flex items-start gap-1.5 rounded-md border border-status-warning bg-status-warning-bg px-2.5 py-2 text-xs text-status-warning-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>El horario general de la sucursal no está configurado — el número puede no ser preciso.</span>
              </div>
            ) : undefined}
          >
            <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-muted-foreground whitespace-nowrap">Capacidad diaria:</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={capacidadDiaria}
                onChange={(e) => setCapacidadDiaria(Math.max(1, parseInt(e.target.value) || 1))}
                onBlur={(e) => saveCapacidadDiaria(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-7 w-16 text-xs"
              />
              <span className="text-xs text-muted-foreground">cortes/barbero</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground/70" onClick={(e) => e.stopPropagation()}>
              Ya no se usa para calcular la ocupación — pendiente de revisar.
            </p>
          </MetricCard>
        </div>
      </div>

      {/* Ingresos y Ventas — resto pendiente de reubicar en Build 2 (Plata real) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">📈 Ingresos y Ventas</h2>
          <p className="text-sm text-muted-foreground">Estas métricas te muestran cuánto estás vendiendo y cómo evoluciona tu facturación.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ingresosCards.map((metric) => (
            <MetricCard key={metric.dataKey} metric={metric} data={derivedMetrics} latest={latest} onSelect={setSelectedMetric} />
          ))}
        </div>
      </div>

      {/* Costos y Rentabilidad — resto pendiente de reubicar en Build 2 (Plata real) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">💰 Costos y Rentabilidad</h2>
          <p className="text-sm text-muted-foreground">Estas métricas te muestran cuánto estás ganando realmente después de todos los gastos.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {costosCards.map((metric) => (
            <MetricCard key={metric.dataKey} metric={metric} data={derivedMetrics} latest={latest} onSelect={setSelectedMetric} />
          ))}
        </div>
      </div>

      {/* Comportamiento del Cliente */}
      {behaviorSection}

      {/* Detail Dialog */}
      <MetricDetailDialog
        open={!!selectedMetric}
        onOpenChange={(v) => { if (!v) setSelectedMetric(null); }}
        metric={selectedMetric}
        data={derivedMetrics}
      />
    </div>
  );
}
