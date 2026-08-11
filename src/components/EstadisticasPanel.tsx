import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, Scissors, Calendar, Target,
  PiggyBank, Receipt, BarChart3, Percent,
  Clock, Trophy, DollarSign, TrendingUp, AlertTriangle,
  ArrowUpRight, ArrowDownRight, CreditCard, Gift, Wallet, ShoppingBag,
  Sparkles, UserPlus, UserCheck,
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
import { DonutCard } from './estadisticas/DonutCard';
import { RankingBarCard, RankingBarItem } from './estadisticas/RankingBarCard';
import { useEstadisticasData } from './estadisticas/useEstadisticasData';
import { useOcupacionResumen } from './estadisticas/useOcupacionResumen';
import { usePagoMetodoData } from './estadisticas/usePagoMetodoData';
import { useEquipoData, BarberoMonthStats } from './estadisticas/useEquipoData';
import { useServiciosClientesData } from './estadisticas/useServiciosClientesData';
import { DATOS_INCOMPLETOS_MSG } from './estadisticas/rowLimit';

import { calcVariation } from './estadisticas/dateHelpers';
import { DerivedMonthlyMetrics, MetricCardDef } from './estadisticas/types';

type BarberoMetricKey = 'facturacion' | 'servicios' | 'comisionDevengada';

/**
 * Adapta el historial mensual de UN barbero a la forma completa de DerivedMonthlyMetrics para
 * poder reusar MetricDetailDialog (que solo lee monthLabel + metric.dataKey + su Var) sin
 * tocarlo. Los campos ajenos a `key` quedan en 0/null — no representan nada en este contexto.
 */
function buildBarberoSeries(stats: BarberoMonthStats[], key: BarberoMetricKey): DerivedMonthlyMetrics[] {
  return stats.map((s, i) => {
    const value = s[key];
    const prevValue = i > 0 ? stats[i - 1][key] : null;
    const variation = prevValue !== null ? calcVariation(value, prevValue) : null;
    const base: DerivedMonthlyMetrics = {
      monthLabel: s.monthLabel,
      facturacion: 0, servicios: 0, efectivo: 0, mp: 0, costosFijos: 0,
      rentabilidad: 0, ticketPromedio: 0, costoFijoPorServicio: 0,
      costoVariablePorServicio: 0, gananciaPorServicio: 0, puntoEquilibrio: 0,
      tasaOcupacion: 0, recargos: 0, descuentos: 0, costoLaboralPct: 0,
      comisionDevengada: 0, tasaAttachExtras: 0, clientesNuevos: 0,
      clientesManual: 0, clientesImportado: 0, clientesReserva: 0, pctEligioBarbero: 0,
      facturacionVar: null, serviciosVar: null, efectivoVar: null, mpVar: null,
      costosFijosVar: null, rentabilidadVar: null, ticketPromedioVar: null,
      costoFijoPorServicioVar: null, costoVariablePorServicioVar: null,
      gananciaPorServicioVar: null, puntoEquilibrioVar: null, tasaOcupacionVar: null,
      recargosVar: null, descuentosVar: null, costoLaboralPctVar: null,
      comisionDevengadaVar: null, tasaAttachExtrasVar: null, clientesNuevosVar: null,
      pctEligioBarberoVar: null,
    };
    (base as unknown as Record<string, number>)[key] = value;
    (base as unknown as Record<string, number | null>)[`${key}Var`] = variation;
    return base;
  });
}

export function EstadisticasPanel() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [periodoMeses, setPeriodoMeses] = useState('6');
  const [capacidadDiaria, setCapacidadDiaria] = useState(18);
  const [selectedMetric, setSelectedMetric] = useState<MetricCardDef | null>(null);

  const { monthlyData, isLoading, ingresosRaw, datosIncompletos: incompletoEstadisticas } = useEstadisticasData(
    organization?.id,
    currentSucursal,
    periodoMeses,
    capacidadDiaria,
  );

  const {
    ocupacionPorMes, avgDuracionMin, coberturaIncompleta, isLoading: isLoadingOcupacion,
  } = useOcupacionResumen(organization?.id, currentSucursal, periodoMeses);

  const {
    montosMesActual, montosMesAnterior, isLoading: isLoadingPagoMetodo,
    datosIncompletos: incompletoPagoMetodo,
  } = usePagoMetodoData(organization?.id, currentSucursal);

  const {
    rankingActual, productosRanking, historialPorBarbero, isLoading: isLoadingEquipo,
    datosIncompletos: incompletoEquipo,
  } = useEquipoData(organization?.id, currentSucursal, periodoMeses);

  const {
    monthlyStats: serviciosClientesData, ventasAgregadas,
    isLoading: isLoadingServiciosClientes, error: serviciosClientesError,
    datosIncompletos: incompletoServiciosClientes,
  } = useServiciosClientesData(organization?.id, currentSucursal, periodoMeses);

  // Salvaguarda de truncado: si alguna consulta que todavía lee filas crudas llegó al tope,
  // avisamos en vez de mostrar números parciales como si fueran reales.
  const datosIncompletos =
    incompletoEstadisticas || incompletoPagoMetodo || incompletoEquipo || incompletoServiciosClientes;


  const [selectedBarberoDetail, setSelectedBarberoDetail] = useState<{
    metric: MetricCardDef;
    data: DerivedMonthlyMetrics[];
  } | null>(null);

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

  // Derive per-month metrics with variation.
  // Las fórmulas financieras (rentabilidad, ticket promedio, costo por servicio, punto de
  // equilibrio, costo laboral) NO se calculan acá: vienen resueltas de las funciones SQL
  // `fin_*` a través de la RPC `estadisticas_mensuales`. Es la única fuente de verdad —
  // no reintroducir cálculos espejo en el frontend.
  const derivedMetrics: DerivedMonthlyMetrics[] = (() => {
    const today = new Date();
    const currentMonthStr = format(today, 'yyyy-MM');
    const diaActual = today.getDate();
    const ocupacionByMonth = new Map(ocupacionPorMes.map(o => [o.month, o]));
    const serviciosClientesByMonth = new Map(serviciosClientesData.map(s => [s.month, s]));

    const raw = monthlyData.map(m => {
      // Ocupación: horas de servicio vendidas (estimadas con la duración promedio del catálogo
      // activo) ÷ (barberos activos con rol barbero × horario general de la sucursal ese día).
      // No mira horario individual ni bloqueos puntuales. Ver useOcupacionResumen.ts.
      const horasVendidas = (m.servicios * avgDuracionMin) / 60;
      const horasDisponibles = ocupacionByMonth.get(m.month)?.horasDisponibles ?? 0;
      const tasaOcupacion = horasDisponibles > 0 ? (horasVendidas / horasDisponibles) * 100 : 0;

      const sc = serviciosClientesByMonth.get(m.month);

      return {
        monthLabel: m.monthLabel,
        facturacion: m.facturacion,
        servicios: m.servicios,
        efectivo: m.efectivo,
        mp: m.mp,
        costosFijos: m.costosFijos,
        rentabilidad: m.rentabilidad,
        ticketPromedio: m.ticketPromedio,
        costoFijoPorServicio: m.costoFijoPorServicio,
        costoVariablePorServicio: m.costoVariablePorServicio,
        gananciaPorServicio: m.gananciaPorServicio,
        puntoEquilibrio: m.puntoEquilibrio,
        tasaOcupacion,
        recargos: m.recargosTotal,
        descuentos: m.perdida,
        costoLaboralPct: m.costoLaboralPct,
        // Solo tiene sentido por-barbero (Sección Equipo) — a nivel organización queda en 0.
        comisionDevengada: 0,
        tasaAttachExtras: sc?.tasaAttachExtras ?? 0,
        clientesNuevos: sc?.clientesNuevos ?? 0,
        clientesManual: sc?.clientesManual ?? 0,
        clientesImportado: sc?.clientesImportado ?? 0,
        clientesReserva: sc?.clientesReserva ?? 0,
        pctEligioBarbero: sc?.pctEligioBarbero ?? 0,
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
      const prevRecargos = useSameDayComparison ? prevM!.parcialRecargosTotal! : prev?.recargos ?? 0;
      const prevDescuentos = useSameDayComparison ? prevM!.parcialPerdida! : prev?.descuentos ?? 0;

      // Clientes nuevos es acumulativo (como Facturación/Servicios): usa el parcial "mismos
      // primeros N días" del mes anterior cuando corresponde. Attach de extras y % eligió
      // barbero son ratios — se comparan mes completo contra mes completo, sin recorte.
      const prevSc = prevM ? serviciosClientesByMonth.get(prevM.month) : undefined;
      const useSameDayClientes = useSameDayComparison && prevSc?.parcialClientesNuevos !== undefined;
      const prevClientesNuevos = useSameDayClientes ? prevSc!.parcialClientesNuevos! : prev?.clientesNuevos ?? 0;

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
        recargosVar: prev ? calcVariation(curr.recargos, prevRecargos) : null,
        descuentosVar: prev ? calcVariation(curr.descuentos, prevDescuentos) : null,
        // Non-cumulative metrics: compare directly as before
        rentabilidadVar: prev ? calcVariation(curr.rentabilidad, prev.rentabilidad) : null,
        ticketPromedioVar: prev ? calcVariation(curr.ticketPromedio, prev.ticketPromedio) : null,
        costoFijoPorServicioVar: prev ? calcVariation(curr.costoFijoPorServicio, prev.costoFijoPorServicio) : null,
        costoVariablePorServicioVar: prev ? calcVariation(curr.costoVariablePorServicio, prev.costoVariablePorServicio) : null,
        gananciaPorServicioVar: prev ? calcVariation(curr.gananciaPorServicio, prev.gananciaPorServicio) : null,
        puntoEquilibrioVar: prev ? calcVariation(curr.puntoEquilibrio, prev.puntoEquilibrio) : null,
        tasaOcupacionVar: prev ? calcVariation(curr.tasaOcupacion, prevTasaOcupacionParcial !== undefined ? prevTasaOcupacionParcial : prev.tasaOcupacion) : null,
        costoLaboralPctVar: prev ? calcVariation(curr.costoLaboralPct, prev.costoLaboralPct) : null,
        comisionDevengadaVar: null,
        tasaAttachExtrasVar: prev ? calcVariation(curr.tasaAttachExtras, prev.tasaAttachExtras) : null,
        clientesNuevosVar: prev ? calcVariation(curr.clientesNuevos, prevClientesNuevos) : null,
        pctEligioBarberoVar: prev ? calcVariation(curr.pctEligioBarbero, prev.pctEligioBarbero) : null,
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

  // Efectivo y Mercado Pago se retiraron del render en Build 2 (Plata real): las reemplaza el
  // donut "Cómo se cobra" (desglose real por método vía venta_pagos, no esta suma agregada de
  // ingresos). Se deja la definición sin uso en vez de borrarla, por si hiciera falta más adelante.
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
  void ingresosCards; // ver comentario arriba: definición retenida, sin consumidor en el render

  // ---- Sección 2: Plata real ----
  // Costos Fijos / Costo Fijo por Servicio / Costo Variable por Servicio / Ganancia por Servicio
  // se mudan acá tal cual estaban (mismo MetricCardDef, mismo cálculo) + 3 cards nuevas.
  const plataRealCards: MetricCardDef[] = [
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
    {
      title: 'Recargos Cobrados',
      dataKey: 'recargos',
      icon: CreditCard,
      color: 'text-status-info-foreground',
      chartColor: 'hsl(var(--chart-mp))',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Recargos por método de pago cobrados por mes.',
    },
    {
      title: 'Descuentos Regalados',
      dataKey: 'descuentos',
      icon: Gift,
      color: 'text-chart-orange',
      chartColor: 'hsl(var(--chart-orange))',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Plata que decidiste no cobrar por descuentos, por mes.',
    },
    {
      title: 'Costo Laboral % de Facturación',
      dataKey: 'costoLaboralPct',
      icon: Wallet,
      color: 'text-status-error-foreground',
      chartColor: 'hsl(var(--chart-cost))',
      formatFn: (v) => `${v.toFixed(1)}%`,
      shortFormatFn: (v) => `${v.toFixed(0)}%`,
      description: 'Sueldos + comisión de productos, sobre la facturación del mes.',
    },
  ];

  // Donut "Cómo se cobra": 5 métodos de venta_pagos (con fallback a venta.metodo_pago para
  // ventas sin filas propias — mismo patrón que useTransactions.ts). Mapeo color↔método en el
  // mismo orden en que están declarados acá y en el CHECK de metodo_pago: cash/mp/cost/purple/
  // indigo → efectivo/mercado_pago/transferencia/debito/credito.
  const metodoPagoSlices = [
    { label: 'Efectivo', value: montosMesActual.efectivo, color: 'hsl(var(--chart-cash))' },
    { label: 'Mercado Pago', value: montosMesActual.mercado_pago, color: 'hsl(var(--chart-mp))' },
    { label: 'Transferencia', value: montosMesActual.transferencia, color: 'hsl(var(--chart-cost))' },
    { label: 'Débito', value: montosMesActual.debito, color: 'hsl(var(--chart-purple))' },
    { label: 'Crédito', value: montosMesActual.credito, color: 'hsl(var(--chart-indigo))' },
  ];

  const digitalActual = montosMesActual.mercado_pago + montosMesActual.transferencia + montosMesActual.debito + montosMesActual.credito;
  const digitalAnterior = montosMesAnterior.mercado_pago + montosMesAnterior.transferencia + montosMesAnterior.debito + montosMesAnterior.credito;
  const digitalVar = calcVariation(digitalActual, digitalAnterior);

  const digitalTrendText = digitalVar === null ? (
    <span className="text-muted-foreground">Digital: {formatCurrency(digitalActual)} este mes.</span>
  ) : (
    <span className={`inline-flex items-center gap-0.5 ${digitalVar > 0 ? 'text-status-success-foreground' : digitalVar < 0 ? 'text-status-error-foreground' : 'text-muted-foreground'}`}>
      {digitalVar > 0 ? <ArrowUpRight className="h-3 w-3" /> : digitalVar < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
      Digital {digitalVar > 0 ? '+' : ''}{digitalVar.toFixed(1)}% vs. mes anterior
    </span>
  );

  // Donut "Costos del mes": mismos totales que ya agrega useEstadisticasData (no se refetchea
  // Egresos). fijo reusa el color de la card "Costos Fijos"; variable el de "Costo Variable por
  // Servicio"; semivariable no tenía color asignado en ningún lado — se usa --chart-purple (sin
  // uso en esta sección) para no repetir el mismo token 3 veces seguidas en el mismo donut.
  const costosSlices = latest ? [
    { label: 'Fijo', value: latest.costosFijos, color: 'hsl(var(--chart-cost))' },
    { label: 'Variable', value: monthlyData[monthlyData.length - 1]?.costosVariables ?? 0, color: 'hsl(var(--chart-amber))' },
    { label: 'Semivariable', value: monthlyData[monthlyData.length - 1]?.costosSemivariables ?? 0, color: 'hsl(var(--chart-purple))' },
  ] : [];

  const costoLaboralText = latest ? `Costo laboral: ${latest.costoLaboralPct.toFixed(1)}% de la facturación` : '';

  // ---- Sección 3: Equipo ----
  const openBarberoDetail = (barberoId: string, barberoNombre: string, key: BarberoMetricKey, config: {
    title: string; icon: MetricCardDef['icon']; color: string; chartColor: string;
    formatFn: (v: number) => string; shortFormatFn: (v: number) => string;
  }) => {
    const stats = historialPorBarbero.get(barberoId) || [];
    setSelectedBarberoDetail({
      metric: {
        title: `${config.title} — ${barberoNombre}`,
        dataKey: key,
        icon: config.icon,
        color: config.color,
        chartColor: config.chartColor,
        formatFn: config.formatFn,
        shortFormatFn: config.shortFormatFn,
        description: `Evolución mensual de ${barberoNombre}.`,
      },
      data: buildBarberoSeries(stats, key),
    });
  };

  const facturacionRankingData: RankingBarItem[] = rankingActual.map((r) => ({
    id: r.id,
    label: r.nombre,
    value: r.facturacion,
    formattedValue: formatCurrency(r.facturacion),
    sublabel: `Ticket promedio: ${formatCurrency(r.ticketPromedio)}`,
  }));

  const serviciosRankingData: RankingBarItem[] = rankingActual.map((r) => ({
    id: r.id,
    label: r.nombre,
    value: r.servicios,
    formattedValue: `${r.servicios} servicios`,
  }));

  const comisionRankingData: RankingBarItem[] = rankingActual.map((r) => ({
    id: r.id,
    label: r.nombre,
    value: r.comisionDevengada,
    formattedValue: formatCurrency(r.comisionDevengada),
  }));

  const productosRankingData: RankingBarItem[] = productosRanking.map((r) => ({
    id: r.id,
    label: r.nombre,
    value: r.totalProductos,
    formattedValue: formatCurrency(r.totalProductos),
  }));

  // ---- Sección 4: Servicios y clientes ----
  // Donut "Mix de Servicios": top 5 servicios por facturación (venta.total_final) del mes
  // actual + "Otros" agrupando el resto, sobre la misma `ventasData` que ya trae
  // useEstadisticasData (extendida en Build 4 con servicio_nombre/total_final) — sin query nueva.
  const currentMonthStrMix = format(new Date(), 'yyyy-MM');
  const facturacionPorServicio = new Map<string, number>();
  ventasData
    .filter((v) => format(new Date(v.fecha_hora), 'yyyy-MM') === currentMonthStrMix)
    .forEach((v) => {
      const nombre = v.servicio_nombre || 'Sin especificar';
      facturacionPorServicio.set(nombre, (facturacionPorServicio.get(nombre) || 0) + v.total_final);
    });
  const serviciosOrdenados = Array.from(facturacionPorServicio.entries()).sort((a, b) => b[1] - a[1]);
  const top5Servicios = serviciosOrdenados.slice(0, 5);
  const restoServiciosTotal = serviciosOrdenados.slice(5).reduce((sum, [, v]) => sum + v, 0);
  // Colores reusados de Sección 2 (no hay tokens dedicados a servicios). "Otros" usa
  // --muted-foreground en vez de un chart-* — es el único slice pensado para pasar
  // desapercibido, no para competir por atención con los top 5.
  const mixServiciosColores = ['hsl(var(--chart-indigo))', 'hsl(var(--chart-purple))', 'hsl(var(--chart-mp))', 'hsl(var(--chart-amber))', 'hsl(var(--chart-orange))'];
  const mixServiciosSlices = [
    ...top5Servicios.map(([label, value], i) => ({ label, value, color: mixServiciosColores[i] })),
    ...(restoServiciosTotal > 0 ? [{ label: 'Otros', value: restoServiciosTotal, color: 'hsl(var(--muted-foreground))' }] : []),
  ];

  const latestServiciosClientes = serviciosClientesData.length > 0 ? serviciosClientesData[serviciosClientesData.length - 1] : null;

  const tasaAttachExtrasCard: MetricCardDef = {
    title: 'Tasa de Attach de Extras',
    dataKey: 'tasaAttachExtras',
    icon: Sparkles,
    color: 'text-status-info-foreground',
    chartColor: 'hsl(var(--chart-mp))',
    formatFn: (v) => `${v.toFixed(1)}%`,
    shortFormatFn: (v) => `${v.toFixed(0)}%`,
    description: `% de servicios que sumaron al menos un extra. Ingreso por extras este mes: ${formatCurrency(latestServiciosClientes?.ingresoExtras ?? 0)}.`,
  };

  const clientesNuevosCard: MetricCardDef = {
    title: 'Clientes Nuevos',
    dataKey: 'clientesNuevos',
    icon: UserPlus,
    color: 'text-status-success-foreground',
    chartColor: 'hsl(var(--chart-cash))',
    formatFn: (v) => `${v} clientes`,
    shortFormatFn: (v) => `${v}`,
    description: 'Clientes nuevos registrados por mes.',
    origenKeys: { manual: 'clientesManual', importado: 'clientesImportado', reserva: 'clientesReserva' },
  };

  const pctEligioBarberoCard: MetricCardDef = {
    title: '% Eligió Barbero al Reservar',
    dataKey: 'pctEligioBarbero',
    icon: UserCheck,
    color: 'text-status-purple-foreground',
    chartColor: 'hsl(var(--chart-purple))',
    formatFn: (v) => `${v.toFixed(1)}%`,
    shortFormatFn: (v) => `${v.toFixed(0)}%`,
    description: 'De los turnos reservados, qué % eligió un barbero específico en vez de "cualquiera disponible".',
  };

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

  if (isLoading || isLoadingOcupacion || isLoadingPagoMetodo || isLoadingEquipo || isLoadingServiciosClientes) {
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

      {datosIncompletos && (
        <div className="flex items-start gap-1.5 rounded-md border border-status-warning bg-status-warning-bg px-2.5 py-2 text-xs text-status-warning-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{DATOS_INCOMPLETOS_MSG}</span>
        </div>
      )}



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

      {/* Sección 2: Plata real */}
      <div className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plata real</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DonutCard
            title="Cómo se cobra"
            description="Composición de los cobros de este mes."
            data={metodoPagoSlices}
            formatValue={formatCurrency}
            footer={<p className="mt-3 text-xs">{digitalTrendText}</p>}
          />
          <DonutCard
            title="Costos del mes"
            description="Fijo, variable y semivariable."
            data={costosSlices}
            formatValue={formatCurrency}
            footer={<p className="mt-3 text-xs text-muted-foreground">{costoLaboralText}</p>}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plataRealCards.map((metric) => (
            <MetricCard key={metric.dataKey} metric={metric} data={derivedMetrics} latest={latest} onSelect={setSelectedMetric} />
          ))}
        </div>
      </div>

      {/* Sección 3: Equipo */}
      <div className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Equipo</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RankingBarCard
            title="Facturación por Barbero"
            description="Este mes, de mayor a menor."
            icon={DollarSign}
            data={facturacionRankingData}
            onItemClick={(item) => openBarberoDetail(item.id!, item.label, 'facturacion', {
              title: 'Facturación', icon: DollarSign, color: 'text-status-success-foreground',
              chartColor: 'hsl(var(--chart-cash))', formatFn: formatCurrency, shortFormatFn: formatCurrencyShort,
            })}
          />
          <RankingBarCard
            title="Servicios por Barbero"
            description="Cantidad de servicios este mes."
            icon={Scissors}
            data={serviciosRankingData}
            onItemClick={(item) => openBarberoDetail(item.id!, item.label, 'servicios', {
              title: 'Servicios', icon: Scissors, color: 'text-primary',
              chartColor: 'hsl(var(--primary))', formatFn: (v) => `${v} servicios`, shortFormatFn: (v) => `${v}`,
            })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RankingBarCard
            title="Comisión Devengada por Barbero"
            description="Sueldo + comisión de productos, este mes."
            icon={Wallet}
            data={comisionRankingData}
            onItemClick={(item) => openBarberoDetail(item.id!, item.label, 'comisionDevengada', {
              title: 'Comisión Devengada', icon: Wallet, color: 'text-status-error-foreground',
              chartColor: 'hsl(var(--chart-cost))', formatFn: formatCurrency, shortFormatFn: formatCurrencyShort,
            })}
          />
          {productosRankingData.length > 0 && (
            <RankingBarCard
              title="Venta de Productos por Barbero"
              description="Este mes, de mayor a menor."
              icon={ShoppingBag}
              data={productosRankingData}
            />
          )}
        </div>
      </div>

      {/* Sección 4: Servicios y clientes */}
      <div className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Servicios y clientes</h2>

        {serviciosClientesError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {serviciosClientesError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DonutCard
            title="Mix de Servicios"
            description="Facturación por servicio, este mes."
            data={mixServiciosSlices}
            formatValue={formatCurrency}
          />
          <MetricCard metric={tasaAttachExtrasCard} data={derivedMetrics} latest={latest} onSelect={setSelectedMetric} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard metric={clientesNuevosCard} data={derivedMetrics} latest={latest} onSelect={setSelectedMetric} />
          <MetricCard metric={pctEligioBarberoCard} data={derivedMetrics} latest={latest} onSelect={setSelectedMetric} />
        </div>

        {/* Comportamiento del Cliente — reubicado acá tal cual (Build 4), sin cambios de cálculo */}
        {behaviorSection}
      </div>

      {/* Detail Dialog */}
      <MetricDetailDialog
        open={!!selectedMetric}
        onOpenChange={(v) => { if (!v) setSelectedMetric(null); }}
        metric={selectedMetric}
        data={derivedMetrics}
      />

      {/* Detail Dialog — evolución de un barbero (Sección Equipo) */}
      <MetricDetailDialog
        open={!!selectedBarberoDetail}
        onOpenChange={(v) => { if (!v) setSelectedBarberoDetail(null); }}
        metric={selectedBarberoDetail?.metric ?? null}
        data={selectedBarberoDetail?.data ?? []}
      />
    </div>
  );
}
