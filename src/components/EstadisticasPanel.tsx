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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

const chartConfig = {
  facturacion: {
    label: "Facturación",
    color: "hsl(var(--primary))",
  },
  servicios: {
    label: "Servicios",
    color: "hsl(var(--secondary))",
  },
  efectivo: {
    label: "Efectivo",
    color: "hsl(142 76% 36%)",
  },
  mp: {
    label: "Mercado Pago",
    color: "hsl(217 91% 60%)",
  },
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

export function EstadisticasPanel() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [barberosActivos, setBarberosActivos] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [periodoMeses, setPeriodoMeses] = useState('6');
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
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

  // Reset selectedMonth to current when period changes
  useEffect(() => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    setSelectedMonth(currentMonth);
  }, [periodoMeses]);

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
        ingresosQuery,
        egresosQuery,
        barberosQuery,
      ]);

      if (ingresosRes.error) throw ingresosRes.error;
      if (egresosRes.error) throw egresosRes.error;
      if (barberosRes.error) throw barberosRes.error;

      const ingresos = ingresosRes.data || [];
      const egresos = egresosRes.data || [];
      const barberos = barberosRes.data || [];

      setBarberosActivos(barberos.length);

      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      
      const monthlyStats: MonthlyData[] = months.map(monthDate => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        
        const monthIngresos = ingresos.filter(i => {
          if (!i.created_at) return false;
          const ingresoDate = parseISO(i.created_at);
          return ingresoDate >= monthStart && ingresoDate <= monthEnd;
        });

        const monthEgresos = egresos.filter(e => {
          if (!e.Fecha) return false;
          const egresoDate = parseISO(e.Fecha);
          return egresoDate >= monthStart && egresoDate <= monthEnd;
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get selected month data
  const currentMonthData = monthlyData.find(m => m.month === selectedMonth) || {
    month: selectedMonth,
    monthLabel: '',
    facturacion: 0,
    servicios: 0,
    efectivo: 0,
    mp: 0,
    costosFijos: 0,
    costosVariables: 0,
    costosSemivariables: 0,
    totalEgresos: 0,
  };

  // Calculated metrics for selected month
  const ticketPromedio = currentMonthData.servicios > 0 ? currentMonthData.facturacion / currentMonthData.servicios : 0;
  const gananciaNeta = currentMonthData.facturacion - currentMonthData.totalEgresos;
  const rentabilidad = currentMonthData.facturacion > 0 ? (gananciaNeta / currentMonthData.facturacion) * 100 : 0;
  const costoFijoPorServicio = currentMonthData.servicios > 0 ? currentMonthData.costosFijos / currentMonthData.servicios : 0;
  const costoVariablePorServicio = currentMonthData.servicios > 0 ? currentMonthData.costosVariables / currentMonthData.servicios : 0;
  const gananciaPorServicio = ticketPromedio - costoFijoPorServicio - costoVariablePorServicio;
  const puntoEquilibrio = gananciaPorServicio > 0 ? Math.ceil(currentMonthData.costosFijos / gananciaPorServicio) : 0;

  // Tasa de ocupación for selected month
  const [selYear, selMonth] = selectedMonth.split('-').map(Number);
  const workDaysInSelectedMonth = getWorkDaysInMonth(selYear, selMonth - 1);
  const capacidadMaxima = capacidadDiaria * (barberosActivos || 1) * workDaysInSelectedMonth;
  const tasaOcupacion = capacidadMaxima > 0 ? (currentMonthData.servicios / capacidadMaxima) * 100 : 0;

  const metrics = [
    {
      title: 'Facturación',
      value: formatCurrency(currentMonthData.facturacion),
      icon: DollarSign,
      description: 'Cuánto dinero entró al negocio este mes. Es el punto de partida para saber si tu barbería genera lo suficiente.',
      color: 'text-green-600',
    },
    {
      title: 'Costos Fijos',
      value: formatCurrency(currentMonthData.costosFijos),
      icon: PiggyBank,
      description: 'Gastos que pagás todos los meses sin importar cuántos clientes atiendas. Conocerlos te dice cuánto necesitás facturar como mínimo.',
      color: 'text-red-500',
    },
    {
      title: 'Rentabilidad',
      value: `${rentabilidad.toFixed(1)}%`,
      icon: Percent,
      description: 'Qué porcentaje de lo facturado te queda como ganancia real. Si es baja, estás trabajando mucho para ganar poco.',
      color: rentabilidad >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      title: 'Ticket Promedio',
      value: formatCurrency(ticketPromedio),
      icon: Receipt,
      description: 'Cuánto gasta cada cliente en promedio. Subirlo con extras o servicios premium es la forma más rápida de facturar más.',
      color: 'text-blue-600',
    },
    {
      title: 'Costo Fijo por Servicio',
      value: formatCurrency(costoFijoPorServicio),
      icon: BarChart3,
      description: 'Cuánto te cuesta cada cliente solo en costos fijos. Más clientes = más se diluye y más ganás por servicio.',
      color: 'text-orange-500',
    },
    {
      title: 'Costo Variable por Servicio',
      value: formatCurrency(costoVariablePorServicio),
      icon: Scissors,
      description: 'Lo que gastás por cada cliente en insumos y comisiones. Controlarlo protege tu margen de ganancia en cada corte.',
      color: 'text-amber-600',
    },
    {
      title: 'Ganancia por Servicio',
      value: formatCurrency(gananciaPorServicio),
      icon: TrendingUp,
      description: 'Cuánto ganás realmente por cada cliente después de todos los costos. La métrica clave para saber si cada corte vale la pena.',
      color: gananciaPorServicio >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      title: 'Punto de Equilibrio',
      value: `${puntoEquilibrio} clientes`,
      icon: Target,
      description: 'Cuántos clientes necesitás para cubrir todos los costos fijos. Por debajo de este número, estás perdiendo dinero.',
      color: 'text-purple-600',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estadísticas</h1>
          <p className="text-muted-foreground">Cargando datos...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-32" />
              </CardContent>
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
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthlyData.map(m => (
                <SelectItem key={m.month} value={m.month}>
                  {format(parseISO(m.month + '-01'), 'MMMM yyyy', { locale: es })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* 9 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
            </CardContent>
          </Card>
        ))}

        {/* Tasa de ocupación */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Ocupación</CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{tasaOcupacion.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Qué tan llena está tu agenda. Si es baja, tenés capacidad ociosa. Si es muy alta, podrías necesitar más barberos.
            </p>

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
                  <p><strong>Paso 1 — Capacidad máxima:</strong></p>
                  <p>Capacidad = Cortes diarios × Barberos activos × Días laborables (lun-sáb)</p>
                  <p className="text-foreground">{capacidadDiaria} × {barberosActivos} × {workDaysInSelectedMonth} = {capacidadMaxima} servicios</p>
                  <p className="mt-1"><strong>Paso 2 — Tasa de ocupación:</strong></p>
                  <p>(Servicios reales ÷ Capacidad máxima) × 100</p>
                  <p className="text-foreground">({currentMonthData.servicios} ÷ {capacidadMaxima}) × 100 = {tasaOcupacion.toFixed(1)}%</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>

      {/* Billing Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Facturación Mensual</CardTitle>
          <CardDescription>Evolución de la facturación por mes</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFacturacion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="monthLabel" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                }
              />
              <Area 
                type="monotone" 
                dataKey="facturacion" 
                stroke="hsl(var(--primary))" 
                fillOpacity={1} 
                fill="url(#colorFacturacion)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Services Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Servicios por Mes</CardTitle>
          <CardDescription>Cantidad de servicios realizados mensualmente</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="monthLabel" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value) => `${value} servicios`}
                  />
                }
              />
              <Bar 
                dataKey="servicios" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Payment Methods Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Métodos de Pago</CardTitle>
          <CardDescription>Distribución mensual por método de pago</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="monthLabel" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar 
                dataKey="efectivo" 
                stackId="a"
                fill="hsl(142 76% 36%)" 
                radius={[0, 0, 0, 0]}
                name="Efectivo"
              />
              <Bar 
                dataKey="mp" 
                stackId="a"
                fill="hsl(217 91% 60%)" 
                radius={[4, 4, 0, 0]}
                name="Mercado Pago"
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
