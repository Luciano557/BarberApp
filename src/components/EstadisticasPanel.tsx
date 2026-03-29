import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, DollarSign, Users, Scissors, Calendar, Target, 
  PiggyBank, Receipt, BarChart3, Percent, Info, ChevronDown 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO, getDaysInMonth, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, LineChart, Line, ResponsiveContainer
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  costosFijos: number;
  rentabilidad: number;
  ticketPromedio: number;
  costoFijoPorServicio: number;
  costoVariablePorServicio: number;
  gananciaPorServicio: number;
  puntoEquilibrio: number;
  tasaOcupacion: number;
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

function getWorkDaysInMonth(year: number, month: number): number {
  const daysInMonth = getDaysInMonth(new Date(year, month));
  let workDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = getDay(new Date(year, month, d));
    if (day !== 0) workDays++;
  }
  return workDays;
}

function MetricChart({ 
  data, 
  dataKey, 
  color, 
  formatValue,
  type = 'area'
}: { 
  data: DerivedMonthlyMetrics[]; 
  dataKey: keyof DerivedMonthlyMetrics; 
  color: string;
  formatValue: (v: number) => string;
  type?: 'area' | 'bar';
}) {
  const config = { [dataKey]: { label: dataKey, color } };
  
  return (
    <ChartContainer config={config} className="h-40 w-full mt-3">
      {type === 'bar' ? (
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="monthLabel" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
          <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={45} tickFormatter={(v) => formatValue(v)} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatValue(Number(value))} />} />
          <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      ) : (
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="monthLabel" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
          <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={45} tickFormatter={(v) => formatValue(v)} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatValue(Number(value))} />} />
          <Area type="monotone" dataKey={dataKey} stroke={color} fillOpacity={1} fill={`url(#gradient-${dataKey})`} strokeWidth={2} />
        </AreaChart>
      )}
    </ChartContainer>
  );
}

export function EstadisticasPanel() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [barberosActivos, setBarberosActivos] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [periodoMeses, setPeriodoMeses] = useState('6');
  const [capacidadDiaria, setCapacidadDiaria] = useState(() => {
    const saved = localStorage.getItem('estadisticas_capacidad_diaria');
    return saved ? parseInt(saved) : 18;
  });
  const [ocupacionOpen, setOcupacionOpen] = useState(false);

  useEffect(() => {
    if (organization?.id) {
      fetchData();
    }
  }, [organization?.id, periodoMeses, currentSucursal]);

  useEffect(() => {
    localStorage.setItem('estadisticas_capacidad_diaria', String(capacidadDiaria));
  }, [capacidadDiaria]);

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

      const [ingresosRes, egresosRes, barberosRes] = await Promise.all([
        ingresosQuery, egresosQuery, barberosQuery,
      ]);

      if (ingresosRes.error) throw ingresosRes.error;
      if (egresosRes.error) throw egresosRes.error;
      if (barberosRes.error) throw barberosRes.error;

      const ingresos = ingresosRes.data || [];
      const egresos = egresosRes.data || [];
      setBarberosActivos((barberosRes.data || []).length);

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

  // Derive per-month metrics for charts
  const derivedMetrics: DerivedMonthlyMetrics[] = monthlyData.map(m => {
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

  // Latest month values for headline
  const latest = derivedMetrics.length > 0 ? derivedMetrics[derivedMetrics.length - 1] : null;

  type MetricCardDef = {
    title: string;
    dataKey: keyof DerivedMonthlyMetrics;
    icon: typeof DollarSign;
    color: string;
    chartColor: string;
    formatFn: (v: number) => string;
    shortFormatFn: (v: number) => string;
    description: string;
    type?: 'area' | 'bar';
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
      type: 'bar' as const,
    },
  ];

  const renderMetricCard = (metric: MetricCardDef) => (
    <Card key={metric.dataKey}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{metric.description}</p>
        </div>
        <metric.icon className={`h-4 w-4 ${metric.color} shrink-0`} />
      </CardHeader>
      <CardContent>
        {latest && (
          <div className={`text-2xl font-bold ${metric.color} mb-1`}>
            {metric.formatFn(latest[metric.dataKey] as number)}
            <span className="text-xs font-normal text-muted-foreground ml-2">último mes</span>
          </div>
        )}
        <MetricChart
          data={derivedMetrics}
          dataKey={metric.dataKey}
          color={metric.chartColor}
          formatValue={metric.shortFormatFn}
          type={metric.type || 'area'}
        />
      </CardContent>
    </Card>
  );

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

      {/* Metric Cards with Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metricCards.map((metric) => (
          <Card key={metric.dataKey}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{metric.description}</p>
              </div>
              <metric.icon className={`h-4 w-4 ${metric.color} shrink-0`} />
            </CardHeader>
            <CardContent>
              {latest && (
                <div className={`text-2xl font-bold ${metric.color} mb-1`}>
                  {metric.formatFn(latest[metric.dataKey] as number)}
                  <span className="text-xs font-normal text-muted-foreground ml-2">último mes</span>
                </div>
              )}
              <MetricChart
                data={derivedMetrics}
                dataKey={metric.dataKey}
                color={metric.chartColor}
                formatValue={metric.shortFormatFn}
                type={metric.type || 'area'}
              />
            </CardContent>
          </Card>
        ))}

        {/* Tasa de ocupación - special card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Tasa de Ocupación</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Qué tan llena está tu agenda mes a mes.</p>
            </div>
            <Users className="h-4 w-4 text-indigo-600 shrink-0" />
          </CardHeader>
          <CardContent>
            {latest && (
              <div className="text-2xl font-bold text-indigo-600 mb-1">
                {latest.tasaOcupacion.toFixed(1)}%
                <span className="text-xs font-normal text-muted-foreground ml-2">último mes</span>
              </div>
            )}
            <MetricChart
              data={derivedMetrics}
              dataKey="tasaOcupacion"
              color="hsl(230 70% 55%)"
              formatValue={(v) => `${v.toFixed(0)}%`}
            />

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Capacidad diaria:</span>
              <Input
                type="number"
                min={1}
                max={100}
                value={capacidadDiaria}
                onChange={(e) => setCapacidadDiaria(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-7 w-16 text-xs"
              />
              <span className="text-xs text-muted-foreground">cortes/barbero</span>
            </div>

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
          </CardContent>
        </Card>
      </div>

      {/* Servicios por Mes */}
      <Card>
        <CardHeader>
          <CardTitle>Servicios por Mes</CardTitle>
          <CardDescription>Cantidad de servicios realizados mensualmente</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="monthLabel" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value} servicios`} />} />
              <Bar dataKey="servicios" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Métodos de Pago */}
      <Card>
        <CardHeader>
          <CardTitle>Métodos de Pago</CardTitle>
          <CardDescription>Distribución mensual por método de pago</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="monthLabel" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="efectivo" stackId="a" fill="hsl(142 76% 36%)" radius={[0, 0, 0, 0]} name="Efectivo" />
              <Bar dataKey="mp" stackId="a" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} name="Mercado Pago" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
