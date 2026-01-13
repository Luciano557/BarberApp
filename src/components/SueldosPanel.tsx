import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Wallet, Plus, TrendingUp, TrendingDown, Minus, CalendarIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Barber } from '@/types/barbershop';
import { toast } from 'sonner';
import { format, startOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface BarberSalaryData {
  barberId: string;
  barberName: string;
  totalDevengado: number;           // Filtered by period
  totalPagado: number;              // Filtered by period
  saldo: number;                    // Period: devengado - pagado
  detalleIngresos: IngresoDetalle[]; // Individual cash closings for the period
  detallePagos: PagoDetalle[];       // Individual payments for the period
}

interface IngresoDetalle {
  id: number;
  fecha: string;
  dia: string;
  totalFacturado: number;
  sueldo: number;
  efectivo: number;
  mp: number;
}

interface PagoDetalle {
  id: string;
  fecha: string;
  monto: number;
  concepto: string | null;
}

interface PagoSueldo {
  id: string;
  barbero_id: string;
  barbero_nombre: string;
  monto: number;
  fecha: string;
  concepto: string | null;
  created_at: string;
}

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
        <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-medium">{barber.barberName}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Devengado</p>
              <p className="font-medium">{formatCurrency(barber.totalDevengado)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="font-medium text-green-600">{formatCurrency(barber.totalPagado)}</p>
            </div>
            <div className="text-right min-w-[140px]">
              <p className="text-xs text-muted-foreground">Saldo</p>
              {getSaldoBadge(barber.saldo)}
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-8 pr-4 pb-4 space-y-4">
          {/* Ingresos Detail */}
          {barber.detalleIngresos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Cierres de Caja</h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Día</TableHead>
                      <TableHead className="text-right">Efectivo</TableHead>
                      <TableHead className="text-right">MP</TableHead>
                      <TableHead className="text-right">Total Facturado</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {barber.detalleIngresos.map(ingreso => (
                      <TableRow key={ingreso.id}>
                        <TableCell>{format(new Date(ingreso.fecha), "dd/MM/yyyy", { locale: es })}</TableCell>
                        <TableCell className="capitalize">{ingreso.dia}</TableCell>
                        <TableCell className="text-right">{formatCurrency(ingreso.efectivo)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(ingreso.mp)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(ingreso.totalFacturado)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(ingreso.sueldo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Pagos Detail */}
          {barber.detallePagos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Pagos Realizados</h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {barber.detallePagos.map(pago => (
                      <TableRow key={pago.id}>
                        <TableCell>{format(new Date(pago.fecha), "dd/MM/yyyy", { locale: es })}</TableCell>
                        <TableCell className="text-muted-foreground">{pago.concepto || '-'}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">{formatCurrency(pago.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
  const { organization } = useOrganization();
  const [salaryData, setSalaryData] = useState<BarberSalaryData[]>([]);
  const [pagos, setPagos] = useState<PagoSueldo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Date filter for devengado (period start)
  // Default to start of current month
  const [periodStartDate, setPeriodStartDate] = useState<Date>(startOfMonth(new Date()));

  const fetchData = useCallback(async () => {
    if (!organization) return;
    
    setIsLoading(true);
    try {
      // Fetch devengado filtered by period - with full details
      const startDateStr = format(periodStartDate, 'yyyy-MM-dd');
      
      const { data: ingresosFiltrados, error: ingresosFiltradosError } = await supabase
        .from('ingresos')
        .select('id, barbero, sueldo, total_facturado, efectivo, mp, dia, created_at')
        .eq('organization_id', organization.id)
        .eq('estado', 'activo')
        .gte('created_at', `${startDateStr}T00:00:00`)
        .order('created_at', { ascending: false });

      if (ingresosFiltradosError) throw ingresosFiltradosError;

      // Fetch pagos filtered by period
      const { data: pagosFiltrados, error: pagosFiltradosError } = await supabase
        .from('pagos_sueldos')
        .select('*')
        .eq('organization_id', organization.id)
        .gte('created_at', `${startDateStr}T00:00:00`)
        .order('created_at', { ascending: false });

      if (pagosFiltradosError) throw pagosFiltradosError;

      setPagos(pagosFiltrados || []);

      // Calculate devengado per barber for period
      const devengadoPorBarbero: Record<string, number> = {};
      ingresosFiltrados?.forEach(ingreso => {
        const nombre = ingreso.barbero;
        if (nombre) {
          devengadoPorBarbero[nombre] = (devengadoPorBarbero[nombre] || 0) + (ingreso.sueldo || 0);
        }
      });

      // Calculate pagado per barber for period
      const pagadoPorBarbero: Record<string, number> = {};
      pagosFiltrados?.forEach(pago => {
        const nombre = pago.barbero_nombre.replace(/\s+/g, ' ').trim();
        pagadoPorBarbero[nombre] = (pagadoPorBarbero[nombre] || 0) + pago.monto;
      });

      // Build salary data for active barbers
      const data: BarberSalaryData[] = barbers.map(barber => {
        // Normalize name by trimming and collapsing multiple spaces
        const nombreCompleto = `${barber.firstName.trim()} ${barber.lastName.trim()}`.replace(/\s+/g, ' ').trim();
        const totalDevengado = devengadoPorBarbero[nombreCompleto] || devengadoPorBarbero[barber.firstName.trim()] || 0;
        const totalPagado = pagadoPorBarbero[nombreCompleto] || pagadoPorBarbero[barber.firstName.trim()] || 0;
        
        // Get detailed ingresos for this barber
        const detalleIngresos: IngresoDetalle[] = (ingresosFiltrados || [])
          .filter(i => i.barbero === nombreCompleto || i.barbero === barber.firstName.trim())
          .map(i => ({
            id: i.id,
            fecha: i.created_at,
            dia: i.dia || '',
            totalFacturado: Number(i.total_facturado) || 0,
            sueldo: Number(i.sueldo) || 0,
            efectivo: Number(i.efectivo) || 0,
            mp: Number(i.mp) || 0,
          }));

        // Get detailed pagos for this barber
        const detallePagos: PagoDetalle[] = (pagosFiltrados || [])
          .filter(p => p.barbero_nombre.replace(/\s+/g, ' ').trim() === nombreCompleto || 
                       p.barbero_nombre.replace(/\s+/g, ' ').trim() === barber.firstName.trim())
          .map(p => ({
            id: p.id,
            fecha: p.created_at,
            monto: Number(p.monto) || 0,
            concepto: p.concepto,
          }));

        return {
          barberId: barber.id,
          barberName: nombreCompleto || barber.firstName.trim(),
          totalDevengado,
          totalPagado,
          saldo: totalDevengado - totalPagado,
          detalleIngresos,
          detallePagos,
        };
      });

      setSalaryData(data);
    } catch (error) {
      console.error('Error fetching salary data:', error);
      toast.error('Error al cargar datos de sueldos');
    } finally {
      setIsLoading(false);
    }
  }, [organization, barbers, periodStartDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData, periodStartDate]);

  const handleSubmitPago = async () => {
    if (!organization || !selectedBarberId || !monto) {
      toast.error('Complete todos los campos requeridos');
      return;
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    const barber = barbers.find(b => b.id === selectedBarberId);
    if (!barber) {
      toast.error('Barbero no encontrado');
      return;
    }

    setIsSubmitting(true);
    try {
      // Normalize name to avoid spacing issues
      const nombreNormalizado = `${barber.firstName.trim()} ${barber.lastName.trim()}`.replace(/\s+/g, ' ').trim();
      
      const { error } = await supabase
        .from('pagos_sueldos')
        .insert({
          barbero_id: selectedBarberId,
          barbero_nombre: nombreNormalizado,
          monto: montoNum,
          concepto: concepto || null,
          organization_id: organization.id,
        });

      if (error) throw error;

      toast.success('Pago registrado correctamente');
      setIsDialogOpen(false);
      setSelectedBarberId('');
      setMonto('');
      setConcepto('');
      fetchData();
    } catch (error) {
      console.error('Error registering payment:', error);
      toast.error('Error al registrar el pago');
    } finally {
      setIsSubmitting(false);
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
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Debe: {formatCurrency(saldo)}
        </Badge>
      );
    } else if (saldo < 0) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-amber-500/20 text-amber-600 border-amber-500/30">
          <TrendingDown className="h-3 w-3" />
          A favor: {formatCurrency(Math.abs(saldo))}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Minus className="h-3 w-3" />
          Al día
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Sueldos</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Presets */}
          <div className="flex items-center gap-1">
            <Button
              variant={format(periodStartDate, 'yyyy-MM-dd') === format(startOfMonth(new Date()), 'yyyy-MM-dd') ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodStartDate(startOfMonth(new Date()))}
            >
              Este mes
            </Button>
            <Button
              variant={format(periodStartDate, 'yyyy-MM-dd') === format(subDays(new Date(), 15), 'yyyy-MM-dd') ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodStartDate(subDays(new Date(), 15))}
            >
              Últimos 15 días
            </Button>
            <Button
              variant={format(periodStartDate, 'yyyy-MM-dd') === format(subDays(new Date(), 30), 'yyyy-MM-dd') ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodStartDate(subDays(new Date(), 30))}
            >
              Últimos 30 días
            </Button>
          </div>
          
          {/* Custom Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[140px] justify-start text-left font-normal",
                  ![
                    format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                    format(subDays(new Date(), 15), 'yyyy-MM-dd'),
                    format(subDays(new Date(), 30), 'yyyy-MM-dd')
                  ].includes(format(periodStartDate, 'yyyy-MM-dd')) && "border-primary"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Personalizado
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={periodStartDate}
                onSelect={(date) => date && setPeriodStartDate(date)}
                locale={es}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Pago
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Pago de Sueldo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="barber">Barbero *</Label>
                  <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar barbero" />
                    </SelectTrigger>
                    <SelectContent>
                      {barbers.map(barber => (
                        <SelectItem key={barber.id} value={barber.id}>
                          {barber.firstName} {barber.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="monto">Monto *</Label>
                  <Input
                    id="monto"
                    type="number"
                    placeholder="0"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="concepto">Concepto (opcional)</Label>
                  <Textarea
                    id="concepto"
                    placeholder="Ej: Adelanto de sueldo, Pago quincenal..."
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmitPago} disabled={isSubmitting}>
                    {isSubmitting ? 'Registrando...' : 'Registrar Pago'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Devengado {periodStartDate ? `(desde ${format(periodStartDate, "dd/MM/yyyy")})` : '(histórico)'}
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
              Pagado {periodStartDate ? `(desde ${format(periodStartDate, "dd/MM/yyyy")})` : '(histórico)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(salaryData.reduce((acc, b) => acc + b.totalPagado, 0))}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Pendiente (histórico)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(salaryData.reduce((acc, b) => acc + b.saldo, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Salary Table per Barber with expandable details */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen por Barbero</CardTitle>
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

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Barbero</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.map(pago => (
                <TableRow key={pago.id}>
                  <TableCell>
                    {format(new Date(pago.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell className="font-medium">{pago.barbero_nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {pago.concepto || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(pago.monto)}
                  </TableCell>
                </TableRow>
              ))}
              {pagos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No hay pagos registrados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
