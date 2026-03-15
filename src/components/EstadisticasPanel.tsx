import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Users, Scissors, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MonthlyData {
  month: string;
  monthLabel: string;
  facturacion: number;
  servicios: number;
  efectivo: number;
  mp: number;
}

interface Summary {
  totalFacturacion: number;
  totalServicios: number;
  barberosActivos: number;
  crecimiento: number;
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

export function EstadisticasPanel() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalFacturacion: 0,
    totalServicios: 0,
    barberosActivos: 0,
    crecimiento: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [periodoMeses, setPeriodoMeses] = useState('6');

  useEffect(() => {
    if (organization?.id) {
      fetchData();
    }
  }, [organization?.id, periodoMeses, currentSucursal]);

  const fetchData = async () => {
    if (!organization?.id) return;
    setIsLoading(true);

    try {
      const meses = parseInt(periodoMeses);
      const endDate = endOfMonth(new Date());
      const startDate = startOfMonth(subMonths(new Date(), meses - 1));

      // Fetch ingresos (cierres de caja) for the period - usando created_at que tiene la fecha real
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

      const { data: ingresos, error: ingresosError } = await ingresosQuery;

      if (ingresosError) throw ingresosError;

      // Fetch barberos activos
      const { data: barberos, error: barberosError } = await supabase
        .from('barberos')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('activo', true);

      if (barberosError) throw barberosError;

      // Process monthly data
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      
      const monthlyStats: MonthlyData[] = months.map(monthDate => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        
        const monthIngresos = ingresos?.filter(i => {
          if (!i.created_at) return false;
          const ingresoDate = parseISO(i.created_at);
          return ingresoDate >= monthStart && ingresoDate <= monthEnd;
        }) || [];

        const facturacion = monthIngresos.reduce((sum, i) => sum + (i.total_facturado || 0), 0);
        const efectivo = monthIngresos.reduce((sum, i) => sum + (i.efectivo || 0), 0);
        const mp = monthIngresos.reduce((sum, i) => sum + (i.mp || 0), 0);
        const servicios = monthIngresos.reduce((sum, i) => sum + (i.cantidad_de_servicios || 0), 0);

        return {
          month: format(monthDate, 'yyyy-MM'),
          monthLabel: format(monthDate, 'MMM yy', { locale: es }),
          facturacion,
          servicios,
          efectivo,
          mp,
        };
      });

      setMonthlyData(monthlyStats);

      // Calculate summary
      const totalFacturacion = monthlyStats.reduce((sum, m) => sum + m.facturacion, 0);
      const totalServicios = monthlyStats.reduce((sum, m) => sum + m.servicios, 0);

      // Calculate growth (compare last month vs previous month)
      let crecimiento = 0;
      if (monthlyStats.length >= 2) {
        const lastMonth = monthlyStats[monthlyStats.length - 1].facturacion;
        const prevMonth = monthlyStats[monthlyStats.length - 2].facturacion;
        if (prevMonth > 0) {
          crecimiento = ((lastMonth - prevMonth) / prevMonth) * 100;
        }
      }

      setSummary({
        totalFacturacion,
        totalServicios,
        barberosActivos: barberos?.length || 0,
        crecimiento,
      });

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
      <div className="flex items-center justify-between">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturación Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalFacturacion)}</div>
            <p className="text-xs text-muted-foreground">En el período seleccionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Realizados</CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalServicios.toLocaleString('es-AR')}</div>
            <p className="text-xs text-muted-foreground">En el período seleccionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Barberos Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.barberosActivos}</div>
            <p className="text-xs text-muted-foreground">Actualmente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crecimiento</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.crecimiento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.crecimiento >= 0 ? '+' : ''}{summary.crecimiento.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">vs mes anterior</p>
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
