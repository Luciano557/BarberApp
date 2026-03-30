import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, DollarSign, Users, Scissors, Calendar, Target, 
  PiggyBank, Receipt, BarChart3, Percent, Info, ChevronDown,
  ArrowUpRight, ArrowDownRight, Clock, Trophy
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO, getDaysInMonth, getDay, differenceInWeeks, differenceInDays, min, eachDayOfInterval, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Line, ResponsiveContainer
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface MonthlyData {
  month: string;
  monthLabel: string;
  facturacion: number;
  servicios: number;
  efectivo: number;
  mp: number;
  costosFijos: number;
  costosVariables: number;
  costosSemivariables: number;
  totalEgresos: number;
}

interface DerivedMonthlyMetrics {
  monthLabel: string;
  facturacion: number;
  servicios: number;
  efectivo: number;
  mp: number;
  costosFijos: number;
  rentabilidad: number;
  ticketPromedio: number;
  costoFijoPorServicio: number;
  costoVariablePorServicio: number;
  gananciaPorServicio: number;
  puntoEquilibrio: number;
  tasaOcupacion: number;
  // Variation fields (% change vs previous month)
  facturacionVar: number | null;
  serviciosVar: number | null;
  efectivoVar: number | null;
  mpVar: number | null;
  costosFijosVar: number | null;
  rentabilidadVar: number | null;
  ticketPromedioVar: number | null;
  costoFijoPorServicioVar: number | null;
  costoVariablePorServicioVar: number | null;
  gananciaPorServicioVar: number | null;
  puntoEquilibrioVar: number | null;
  tasaOcupacionVar: number | null;
}

const chartConfig = {
  facturacion: { label: "Facturación", color: "hsl(var(--primary))" },
  servicios: { label: "Servicios", color: "hsl(var(--secondary))" },
  efectivo: { label: "Efectivo", color: "hsl(142 76% 36%)" },
  mp: { label: "Mercado Pago", color: "hsl(217 91% 60%)" },
  costosFijos: { label: "Costos Fijos", color: "hsl(0 84% 60%)" },
  rentabilidad: { label: "Rentabilidad", color: "hsl(142 76% 36%)" },
  ticketPromedio: { label: "Ticket Promedio", color: "hsl(217 91% 60%)" },
  costoFijoPorServicio: { label: "Costo Fijo/Servicio", color: "hsl(25 95% 53%)" },
  costoVariablePorServicio: { label: "Costo Variable/Servicio", color: "hsl(45 93% 47%)" },
  gananciaPorServicio: { label: "Ganancia/Servicio", color: "hsl(142 76% 36%)" },
  puntoEquilibrio: { label: "Punto de Equilibrio", color: "hsl(270 70% 60%)" },
  tasaOcupacion: { label: "Tasa de Ocupación", color: "hsl(230 70% 55%)" },
};

const varKeyMap: Record<string, keyof DerivedMonthlyMetrics> = {
  facturacion: 'facturacionVar',
  servicios: 'serviciosVar',
  efectivo: 'efectivoVar',
  mp: 'mpVar',
  costosFijos: 'costosFijosVar',
  rentabilidad: 'rentabilidadVar',
  ticketPromedio: 'ticketPromedioVar',
  costoFijoPorServicio: 'costoFijoPorServicioVar',
  costoVariablePorServicio: 'costoVariablePorServicioVar',
  gananciaPorServicio: 'gananciaPorServicioVar',
  puntoEquilibrio: 'puntoEquilibrioVar',
  tasaOcupacion: 'tasaOcupacionVar',
};

function getWorkDaysInMonth(year: number, month: number): number {
  const daysInMonth = getDaysInMonth(new Date(year, month));
  let workDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = getDay(new Date(year, month, d));
    if (day !== 0) workDays++;
  }
  return workDays;
}

function calcVariation(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function MetricChart({ 
  data, 
  dataKey, 
  color, 
  formatValue,
}: { 
  data: DerivedMonthlyMetrics[]; 
  dataKey: keyof DerivedMonthlyMetrics; 
  color: string;
  formatValue: (v: number) => string;
}) {
  const config = { [dataKey]: { label: dataKey, color } };
  const vKey = varKeyMap[dataKey as string];

  return (
    <ChartContainer config={config} className="h-40 w-full mt-3">
      <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="monthLabel" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
        <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={45} tickFormatter={(v) => formatValue(v)} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => {
                const varVal = vKey ? (item.payload as any)?.[vKey] : null;
                const varStr = varVal != null ? ` (${varVal > 0 ? '+' : ''}${varVal.toFixed(1)}%)` : '';
                return `${formatValue(Number(value))}${varStr}`;
              }}
            />
          }
        />
        <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} opacity={0.7} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

function MetricDetailDialog({
  open,
  onOpenChange,
  metric,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metric: MetricCardDef | null;
  data: DerivedMonthlyMetrics[];
}) {
  if (!metric) return null;
  const config = { [metric.dataKey]: { label: metric.title, color: metric.chartColor } };
  const vKey = varKeyMap[metric.dataKey as string];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <metric.icon className={`h-5 w-5 ${metric.color}`} />
            {metric.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{metric.description}</p>
        </DialogHeader>

        {/* Big chart */}
        <ChartContainer config={config} className="h-64 w-full">
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="monthLabel" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={55} tickFormatter={(v) => metric.shortFormatFn(v)} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => {
                    const varVal = vKey ? (item.payload as any)?.[vKey] : null;
                    const varStr = varVal != null ? ` (${varVal > 0 ? '+' : ''}${varVal.toFixed(1)}%)` : '';
                    return `${metric.formatFn(Number(value))}${varStr}`;
                  }}
                />
              }
            />
            <Bar dataKey={metric.dataKey} fill={metric.chartColor} radius={[4, 4, 0, 0]} opacity={0.6} />
            <Line type="monotone" dataKey={metric.dataKey} stroke={metric.chartColor} strokeWidth={2.5} dot={{ r: 3, fill: metric.chartColor }} />
          </ComposedChart>
        </ChartContainer>

        {/* Detail table */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Variación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => {
                const value = row[metric.dataKey] as number;
                const variation = vKey ? (row[vKey] as number | null) : null;
                return (
                  <TableRow key={row.monthLabel}>
                    <TableCell className="font-medium">{row.monthLabel}</TableCell>
                    <TableCell className="text-right">{metric.formatFn(value)}</TableCell>
                    <TableCell className="text-right">
                      {variation == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={`inline-flex items-center gap-0.5 ${variation > 0 ? 'text-green-600' : variation < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {variation > 0 ? <ArrowUpRight className="h-3 w-3" /> : variation < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                          {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type MetricCardDef = {
  title: string;
  dataKey: keyof DerivedMonthlyMetrics;
  icon: typeof DollarSign;
  color: string;
  chartColor: string;
  formatFn: (v: number) => string;
  shortFormatFn: (v: number) => string;
  description: string;
};

export function EstadisticasPanel() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [barberosActivos, setBarberosActivos] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [periodoMeses, setPeriodoMeses] = useState('6');
  const [capacidadDiaria, setCapacidadDiaria] = useState(18);
  const [ocupacionOpen, setOcupacionOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricCardDef | null>(null);
  const [ventasData, setVentasData] = useState<{ fecha_hora: string }[]>([]);
  const [ingresosRaw, setIngresosRaw] = useState<{ created_at: string; cantidad_de_servicios: number }[]>([]);

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

  useEffect(() => {
    if (organization?.id) {
      fetchData();
    }
  }, [organization?.id, periodoMeses, currentSucursal]);

  const saveCapacidadDiaria = async (value: number) => {
    if (!currentSucursal?.id || !organization?.id) return;
    await supabase
      .from('sucursal_settings')
      .upsert(
        { sucursal_id: currentSucursal.id, organization_id: organization.id, capacidad_diaria: value },
        { onConflict: 'sucursal_id' }
      );
  };

  const fetchData = async () => {
    if (!organization?.id) return;
    setIsLoading(true);

    try {
      const meses = parseInt(periodoMeses);
      const endDate = endOfMonth(new Date());
      const startDate = startOfMonth(subMonths(new Date(), meses - 1));

      let ingresosQuery = supabase
        .from('ingresos')
        .select('id, created_at, total_facturado, efectivo, mp, cantidad_de_servicios, sueldo, estado')
        .eq('organization_id', organization.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .neq('estado', 'eliminado');

      if (currentSucursal) {
        ingresosQuery = ingresosQuery.eq('sucursal_id', currentSucursal.id);
      }

      let egresosQuery = supabase
        .from('Egresos')
        .select('Monto, tipo_costo, Fecha')
        .eq('organization_id', organization.id)
        .gte('Fecha', startDate.toISOString())
        .lte('Fecha', endDate.toISOString());

      if (currentSucursal) {
        egresosQuery = egresosQuery.eq('sucursal_id', currentSucursal.id);
      }

      let barberosQuery = supabase
        .from('barberos')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('activo', true);

      if (currentSucursal) {
        barberosQuery = barberosQuery.eq('sucursal_id', currentSucursal.id);
      }

      let ventasQuery = supabase
        .from('venta')
        .select('fecha_hora')
        .eq('organization_id', organization.id)
        .eq('estado', 'activo')
        .gte('fecha_hora', startDate.toISOString())
        .lte('fecha_hora', endDate.toISOString());

      if (currentSucursal) {
        ventasQuery = ventasQuery.eq('sucursal_id', currentSucursal.id);
      }

      const [ingresosRes, egresosRes, barberosRes, ventasRes] = await Promise.all([
        ingresosQuery, egresosQuery, barberosQuery, ventasQuery,
      ]);

      if (ingresosRes.error) throw ingresosRes.error;
      if (egresosRes.error) throw egresosRes.error;
      if (barberosRes.error) throw barberosRes.error;

      const ingresos = ingresosRes.data || [];
      const egresos = egresosRes.data || [];
      setBarberosActivos((barberosRes.data || []).length);
      setVentasData((ventasRes.data || []) as { fecha_hora: string }[]);
      setIngresosRaw((ingresosRes.data || []).map(i => ({
        created_at: i.created_at,
        cantidad_de_servicios: i.cantidad_de_servicios || 0,
      })));
      const months = eachMonthOfInterval({ start: startDate, end: endDate });

      const monthlyStats: MonthlyData[] = months.map(monthDate => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const monthIngresos = ingresos.filter(i => {
          if (!i.created_at) return false;
          const d = parseISO(i.created_at);
          return d >= monthStart && d <= monthEnd;
        });

        const monthEgresos = egresos.filter(e => {
          if (!e.Fecha) return false;
          const d = parseISO(e.Fecha);
          return d >= monthStart && d <= monthEnd;
        });

        const costosFijos = monthEgresos.filter(e => e.tipo_costo === 'fijo').reduce((s, e) => s + (Number(e.Monto) || 0), 0);
        const costosVariables = monthEgresos.filter(e => e.tipo_costo === 'variable').reduce((s, e) => s + (Number(e.Monto) || 0), 0);
        const costosSemivariables = monthEgresos.filter(e => e.tipo_costo === 'semivariable').reduce((s, e) => s + (Number(e.Monto) || 0), 0);

        return {
          month: format(monthDate, 'yyyy-MM'),
          monthLabel: format(monthDate, 'MMM yy', { locale: es }),
          facturacion: monthIngresos.reduce((sum, i) => sum + (i.total_facturado || 0), 0),
          servicios: monthIngresos.reduce((sum, i) => sum + (i.cantidad_de_servicios || 0), 0),
          efectivo: monthIngresos.reduce((sum, i) => sum + (i.efectivo || 0), 0),
          mp: monthIngresos.reduce((sum, i) => sum + (i.mp || 0), 0),
          costosFijos,
          costosVariables,
          costosSemivariables,
          totalEgresos: costosFijos + costosVariables + costosSemivariables,
        };
      });

      setMonthlyData(monthlyStats);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const formatCurrencyShort = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Derive per-month metrics with variation
  const derivedMetrics: DerivedMonthlyMetrics[] = (() => {
    const raw = monthlyData.map(m => {
      const ticketPromedio = m.servicios > 0 ? m.facturacion / m.servicios : 0;
      const gananciaNeta = m.facturacion - m.totalEgresos;
      const rentabilidad = m.facturacion > 0 ? (gananciaNeta / m.facturacion) * 100 : 0;
      const costoFijoPorServicio = m.servicios > 0 ? m.costosFijos / m.servicios : 0;
      const costoVariablePorServicio = m.servicios > 0 ? m.costosVariables / m.servicios : 0;
      const gananciaPorServicio = ticketPromedio - costoFijoPorServicio - costoVariablePorServicio;
      const puntoEquilibrio = gananciaPorServicio > 0 ? Math.ceil(m.costosFijos / gananciaPorServicio) : 0;

      const [y, mo] = m.month.split('-').map(Number);
      const workDays = getWorkDaysInMonth(y, mo - 1);
      const cap = capacidadDiaria * (barberosActivos || 1) * workDays;
      const tasaOcupacion = cap > 0 ? (m.servicios / cap) * 100 : 0;

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
      return {
        ...curr,
        facturacionVar: prev ? calcVariation(curr.facturacion, prev.facturacion) : null,
        serviciosVar: prev ? calcVariation(curr.servicios, prev.servicios) : null,
        efectivoVar: prev ? calcVariation(curr.efectivo, prev.efectivo) : null,
        mpVar: prev ? calcVariation(curr.mp, prev.mp) : null,
        costosFijosVar: prev ? calcVariation(curr.costosFijos, prev.costosFijos) : null,
        rentabilidadVar: prev ? calcVariation(curr.rentabilidad, prev.rentabilidad) : null,
        ticketPromedioVar: prev ? calcVariation(curr.ticketPromedio, prev.ticketPromedio) : null,
        costoFijoPorServicioVar: prev ? calcVariation(curr.costoFijoPorServicio, prev.costoFijoPorServicio) : null,
        costoVariablePorServicioVar: prev ? calcVariation(curr.costoVariablePorServicio, prev.costoVariablePorServicio) : null,
        gananciaPorServicioVar: prev ? calcVariation(curr.gananciaPorServicio, prev.gananciaPorServicio) : null,
        puntoEquilibrioVar: prev ? calcVariation(curr.puntoEquilibrio, prev.puntoEquilibrio) : null,
        tasaOcupacionVar: prev ? calcVariation(curr.tasaOcupacion, prev.tasaOcupacion) : null,
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

  const ingresosCards: MetricCardDef[] = [
    {
      title: 'Facturación',
      dataKey: 'facturacion',
      icon: DollarSign,
      color: 'text-green-600',
      chartColor: 'hsl(142 76% 36%)',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Cuánto dinero entró al negocio cada mes.',
    },
    {
      title: 'Ticket Promedio',
      dataKey: 'ticketPromedio',
      icon: Receipt,
      color: 'text-blue-600',
      chartColor: 'hsl(217 91% 60%)',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Cuánto gasta cada cliente en promedio por visita.',
    },
    {
      title: 'Efectivo',
      dataKey: 'efectivo',
      icon: DollarSign,
      color: 'text-green-600',
      chartColor: 'hsl(142 76% 36%)',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Ingresos mensuales cobrados en efectivo.',
    },
    {
      title: 'Mercado Pago',
      dataKey: 'mp',
      icon: DollarSign,
      color: 'text-blue-600',
      chartColor: 'hsl(217 91% 60%)',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Ingresos mensuales cobrados por Mercado Pago.',
    },
  ];

  const costosCards: MetricCardDef[] = [
    {
      title: 'Costos Fijos',
      dataKey: 'costosFijos',
      icon: PiggyBank,
      color: 'text-red-500',
      chartColor: 'hsl(0 84% 60%)',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Gastos mensuales independientes de la cantidad de clientes.',
    },
    {
      title: 'Costo Fijo por Servicio',
      dataKey: 'costoFijoPorServicio',
      icon: BarChart3,
      color: 'text-orange-500',
      chartColor: 'hsl(25 95% 53%)',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Cuánto te cuesta cada cliente solo en costos fijos.',
    },
    {
      title: 'Costo Variable por Servicio',
      dataKey: 'costoVariablePorServicio',
      icon: Scissors,
      color: 'text-amber-600',
      chartColor: 'hsl(45 93% 47%)',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Lo que gastás por cada cliente en insumos y comisiones.',
    },
    {
      title: 'Ganancia por Servicio',
      dataKey: 'gananciaPorServicio',
      icon: TrendingUp,
      color: latest && latest.gananciaPorServicio >= 0 ? 'text-green-600' : 'text-red-600',
      chartColor: 'hsl(142 76% 36%)',
      formatFn: formatCurrency,
      shortFormatFn: formatCurrencyShort,
      description: 'Cuánto ganás realmente por cada cliente después de costos.',
    },
    {
      title: 'Rentabilidad',
      dataKey: 'rentabilidad',
      icon: Percent,
      color: latest && latest.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600',
      chartColor: 'hsl(142 76% 36%)',
      formatFn: (v) => `${v.toFixed(1)}%`,
      shortFormatFn: (v) => `${v.toFixed(0)}%`,
      description: 'Porcentaje de lo facturado que queda como ganancia real.',
    },
    {
      title: 'Punto de Equilibrio',
      dataKey: 'puntoEquilibrio',
      icon: Target,
      color: 'text-purple-600',
      chartColor: 'hsl(270 70% 60%)',
      formatFn: (v) => `${v} clientes`,
      shortFormatFn: (v) => `${v}`,
      description: 'Clientes necesarios para cubrir todos los costos fijos.',
    },
  ];

  const renderVariationBadge = (metric: MetricCardDef) => {
    const vKey = varKeyMap[metric.dataKey as string];
    if (!latest || !vKey) return null;
    const variation = latest[vKey] as number | null;
    if (variation == null) return null;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${variation > 0 ? 'text-green-600' : variation < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
        {variation > 0 ? <ArrowUpRight className="h-3 w-3" /> : variation < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
        {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
      </span>
    );
  };

  const renderMetricCard = (metric: MetricCardDef) => (
    <Card
      key={metric.dataKey}
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => setSelectedMetric(metric)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{metric.description}</p>
        </div>
        <metric.icon className={`h-4 w-4 ${metric.color} shrink-0`} />
      </CardHeader>
      <CardContent>
        {latest && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-2xl font-bold ${metric.color}`}>
              {metric.formatFn(latest[metric.dataKey] as number)}
            </span>
            {renderVariationBadge(metric)}
          </div>
        )}
        <MetricChart
          data={derivedMetrics}
          dataKey={metric.dataKey}
          color={metric.chartColor}
          formatValue={metric.shortFormatFn}
        />
      </CardContent>
    </Card>
  );

  // ---- Comportamiento del Cliente ----
  const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const DAY_NAMES_FULL = ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'];

  const behaviorData = useMemo(() => {
    if (!ventasData.length) return { byDay: [], byHour: [], peakSlots: [] };

    const tz = organization?.timezone || 'America/Argentina/Buenos_Aires';
    const meses = parseInt(periodoMeses);
    const endDateRaw = endOfMonth(new Date());
    const startDate = startOfMonth(subMonths(new Date(), meses - 1));
    // No incluir días futuros: usar min(endOfMonth, hoy)
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

    const dayCounts: number[] = Array(7).fill(0);
    const hourCounts: number[] = Array(24).fill(0);
    const dayHourCounts: Record<string, number> = {};

    ventasData.forEach(v => {
      try {
        const localStr = new Date(v.fecha_hora).toLocaleString('en-US', { timeZone: tz });
        const local = new Date(localStr);
        const day = local.getDay();
        const hour = local.getHours();
        dayCounts[day]++;
        hourCounts[hour]++;
        const key = `${day}-${hour}`;
        dayHourCounts[key] = (dayHourCounts[key] || 0) + 1;
      } catch {}
    });

    // Reorder: Lun-Dom
    const dayOrder = [1, 2, 3, 4, 5, 6, 0];
    const byDay = dayOrder.map(d => ({
      name: DAY_NAMES[d],
      ventas: actualOccurrences[d] > 0 ? Math.round((dayCounts[d] / actualOccurrences[d]) * 10) / 10 : 0,
    }));

    // Only hours with activity — dividir por totalDays para promedio diario real
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
  }, [ventasData, organization?.timezone, periodoMeses]);

  const behaviorChartConfig = {
    ventas: { label: "Ventas promedio", color: "hsl(var(--primary))" },
  };

  const behaviorSection = ventasData.length > 0 ? (
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
              <p className="text-xs text-muted-foreground mt-0.5">Promedio semanal de ventas por día.</p>
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
                <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Ventas por hora del día */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Ventas por hora del día</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Distribución horaria promedio de ventas.</p>
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
                <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Horarios pico */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Horarios Pico</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Los 3 momentos de mayor demanda en tu negocio.</p>
            </div>
            <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
          </CardHeader>
          <CardContent>
            {behaviorData.peakSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {behaviorData.peakSlots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
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
    color: 'text-indigo-600',
    chartColor: 'hsl(230 70% 55%)',
    formatFn: (v) => `${v.toFixed(1)}%`,
    shortFormatFn: (v) => `${v.toFixed(0)}%`,
    description: 'Qué tan llena está tu agenda mes a mes.',
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estadísticas</h1>
          <p className="text-muted-foreground">Cargando datos...</p>
        </div>
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estadísticas</h1>
          <p className="text-muted-foreground">Análisis y métricas del negocio</p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Grupo 1: Ingresos y Ventas */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">📈 Ingresos y Ventas</h2>
          <p className="text-sm text-muted-foreground">Estas métricas te muestran cuánto estás vendiendo y cómo evoluciona tu facturación.</p>
        </div>
        {/* Servicios - full width first */}
        <Card
          className="cursor-pointer transition-shadow hover:shadow-md md:col-span-2"
          onClick={() => setSelectedMetric(serviciosCard)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">{serviciosCard.title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{serviciosCard.description}</p>
            </div>
            <serviciosCard.icon className={`h-4 w-4 ${serviciosCard.color} shrink-0`} />
          </CardHeader>
          <CardContent>
            {latest && (
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-2xl font-bold ${serviciosCard.color}`}>
                  {serviciosCard.formatFn(latest[serviciosCard.dataKey] as number)}
                </span>
                {renderVariationBadge(serviciosCard)}
              </div>
            )}
            <ChartContainer config={{ [serviciosCard.dataKey]: { label: serviciosCard.title, color: serviciosCard.chartColor } }} className="h-52 w-full mt-3">
              <ComposedChart data={derivedMetrics} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="monthLabel" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={45} tickFormatter={serviciosCard.shortFormatFn} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => {
                        const varVal = (item.payload as any)?.serviciosVar;
                        const varStr = varVal != null ? ` (${varVal > 0 ? '+' : ''}${varVal.toFixed(1)}%)` : '';
                        return `${serviciosCard.formatFn(Number(value))}${varStr}`;
                      }}
                    />
                  }
                />
                <Bar dataKey="servicios" fill={serviciosCard.chartColor} radius={[3, 3, 0, 0]} opacity={0.7} />
                <Line type="monotone" dataKey="servicios" stroke={serviciosCard.chartColor} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ingresosCards.map(renderMetricCard)}
        </div>

      </div>

      {/* Grupo 2: Costos y Rentabilidad */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">💰 Costos y Rentabilidad</h2>
          <p className="text-sm text-muted-foreground">Estas métricas te muestran cuánto estás ganando realmente después de todos los gastos.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {costosCards.map(renderMetricCard)}
        </div>
      </div>

      {/* Grupo 3: Capacidad y Eficiencia */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">⚡ Capacidad y Eficiencia</h2>
          <p className="text-sm text-muted-foreground">Estas métricas te muestran qué tan bien estás aprovechando tu barbería.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => setSelectedMetric(ocupacionMetricDef)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">Tasa de Ocupación</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Qué tan llena está tu agenda mes a mes.</p>
              </div>
              <Users className="h-4 w-4 text-indigo-600 shrink-0" />
            </CardHeader>
            <CardContent>
              {latest && (
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-bold text-indigo-600">
                    {latest.tasaOcupacion.toFixed(1)}%
                  </span>
                  {renderVariationBadge(ocupacionMetricDef)}
                </div>
              )}
              <MetricChart
                data={derivedMetrics}
                dataKey="tasaOcupacion"
                color="hsl(230 70% 55%)"
                formatValue={(v) => `${v.toFixed(0)}%`}
              />

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

              <div onClick={(e) => e.stopPropagation()}>
                <Collapsible open={ocupacionOpen} onOpenChange={setOcupacionOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
                    <Info className="h-3 w-3" />
                    ¿Cómo se calcula?
                    <ChevronDown className={`h-3 w-3 transition-transform ${ocupacionOpen ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-3 bg-muted rounded-md text-xs text-muted-foreground space-y-1">
                      <p><strong>Capacidad máxima:</strong> Cortes diarios × Barberos activos × Días laborables (lun-sáb)</p>
                      <p><strong>Tasa:</strong> (Servicios reales ÷ Capacidad máxima) × 100</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Grupo 4: Comportamiento del Cliente */}
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
