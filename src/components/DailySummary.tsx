import { Banknote, CreditCard, Receipt, TrendingUp, Clock, User, ChevronLeft, ChevronRight, CalendarIcon, Percent, CheckCircle, Loader2, Trash2, Ban, XCircle, CalendarClock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Transaction, Barber, Service, Line, PaymentMethod, isDigitalMethod } from '@/types/barbershop';
import { format, addDays, subDays, isToday, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useCashClosing } from '@/hooks/useCashClosing';
import { calcComisionProductos, ProductoCfg } from '@/lib/comisionProductos';
import { CashClosingHistory } from './CashClosingHistory';
import { AnulacionesCierreHistory } from './AnulacionesCierreHistory';
import { VoidTransactionDialog } from './VoidTransactionDialog';
import { BackfillWizard } from './BackfillWizard';
import { MultiDayClosingSummary } from './MultiDayClosingSummary';
import { PinGateDialog } from './PinGateDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { usePinProtection } from '@/hooks/usePinProtection';
import { toast } from 'sonner';
import { getStartOfDayLocal, getEndOfDayLocal } from '@/lib/dateUtils';

interface DailySummaryProps {
  summary: {
    count: number;
    totalEfectivo: number;
    totalMercadoPago: number;
    total: number;
    transactions: Transaction[];
  };
  barbers: Barber[];
  services: Service[];
  lines: Line[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onVoidTransaction?: (transactionId: string, voidedBy: string, voidedById: string) => Promise<boolean>;
}

interface BarberSummary {
  barberId: string;
  barberName: string;
  count: number;
  totalEfectivo: number;
  totalMercadoPago: number;
  total: number;
  productosTotal: number;
  serviciosBase: number;
  commissionPct: number;
  commissionAmount: number;
  comisionProductos: number;
}

export function DailySummary({ summary, barbers, services, lines, selectedDate, onDateChange, onVoidTransaction }: DailySummaryProps) {
  const [closingBarber, setClosingBarber] = useState<BarberSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { saveCashClosing } = useCashClosing();
  const [voidingTransaction, setVoidingTransaction] = useState<Transaction | null>(null);
  const [closedBarbers, setClosedBarbers] = useState<Set<string>>(new Set());
  const [closedBarbersData, setClosedBarbersData] = useState<Map<string, { id: number; barberName: string; closed_at: string | null }>>(new Map());
  const [voidingClosure, setVoidingClosure] = useState<{ id: number; barberName: string } | null>(null);
  const [isVoidingClosure, setIsVoidingClosure] = useState(false);
  const [voidReason, setVoidReason] = useState<string>('');
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [pinGateOpen, setPinGateOpen] = useState(false);
  const [pinAction, setPinAction] = useState<'closing' | 'voidClosure' | 'pastDate' | 'history' | 'anulacionesHistory' | 'regularize' | null>(null);
  const [pendingClosingBarber, setPendingClosingBarber] = useState<BarberSummary | null>(null);
  const [pendingVoidClosure, setPendingVoidClosure] = useState<{ id: number; barberName: string } | null>(null);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [regularizingBarber, setRegularizingBarber] = useState<BarberSummary | null>(null);
  const [pendingRegularizeBarber, setPendingRegularizeBarber] = useState<BarberSummary | null>(null);
  const [isRegularizing, setIsRegularizing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [anulacionesHistoryOpen, setAnulacionesHistoryOpen] = useState(false);
  const { user, profile, isOwner, isManager } = useAuth();
  const { requiresPin, validatePin } = usePinProtection();
  const canVoidClosure = isOwner || isManager;
  const canBackfill = isOwner || isManager;
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const validDate = selectedDate instanceof Date && !isNaN(selectedDate.getTime()) 
    ? selectedDate 
    : new Date();

  // Get transactions for selected barber (only active transactions)
  // Mixed payments: a tx can appear in both lists if it has parts in both methods
  const barberTransactions = useMemo(() => {
    if (!closingBarber) return { efectivo: [] as Transaction[], digital: [] as Transaction[] };
    
    const activeTransactions = summary.transactions.filter(
      tx => tx.estado !== 'anulado' && tx.barberId === closingBarber.barberId
    );
    const hasEfectivo = (tx: Transaction) => {
      const payments = tx.payments && tx.payments.length > 0
        ? tx.payments
        : [{ method: tx.paymentMethod, amount: tx.total }];
      return payments.some(p => p.method === 'efectivo' && p.amount > 0);
    };
    const hasDigital = (tx: Transaction) => {
      const payments = tx.payments && tx.payments.length > 0
        ? tx.payments
        : [{ method: tx.paymentMethod, amount: tx.total }];
      return payments.some(p => isDigitalMethod(p.method) && p.amount > 0);
    };
    return {
      efectivo: activeTransactions.filter(hasEfectivo),
      digital: activeTransactions.filter(hasDigital),
    };
  }, [closingBarber, summary.transactions]);

  // Check which barbers have their cash closed for the selected date
  const checkClosedBarbers = useCallback(async () => {
    const tz = organization?.timezone || null;
    const startStr = getStartOfDayLocal(validDate, tz);
    const endStr = getEndOfDayLocal(validDate, tz);
    
    let query = supabase
      .from('ingresos')
      .select('id, barbero, barbero_id, closed_at')
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .neq('estado', 'eliminado');

    if (currentSucursal) {
      query = query.eq('sucursal_id', currentSucursal.id);
    }

    const { data } = await query;

    if (data) {
      const closedIds = new Set(data.map(d => d.barbero_id).filter(Boolean));
      setClosedBarbers(closedIds as Set<string>);
      
      // Store the mapping of barbero_id to ingreso id for voiding
      const dataMap = new Map<string, { id: number; barberName: string; closed_at: string | null }>();
      data.forEach(d => {
        if (d.barbero_id) {
          dataMap.set(d.barbero_id, { id: d.id, barberName: d.barbero || '', closed_at: d.closed_at ?? null });
        }
      });
      setClosedBarbersData(dataMap);
    }
  }, [validDate, organization?.timezone, currentSucursal]);

  // Check closed barbers on date change
  useMemo(() => {
    checkClosedBarbers();
  }, [checkClosedBarbers]);

  // Check if a transaction can be voided (barber's cash not closed)
  const canVoidTransaction = useCallback((tx: Transaction): boolean => {
    if (!tx.barberId) return true;
    return !closedBarbers.has(tx.barberId);
  }, [closedBarbers]);

  // Calculate per-barber summaries with commissions (only active transactions)
  const barberSummaries = useMemo(() => {
    const summaryMap = new Map<string, BarberSummary>();

    // Initialize all active barbers with their commission percentage
    barbers.forEach(barber => {
      summaryMap.set(barber.id, {
        barberId: barber.id,
        barberName: `${barber.firstName} ${barber.lastName}`,
        count: 0,
        totalEfectivo: 0,
        totalMercadoPago: 0,
        total: 0,
        productosTotal: 0,
        serviciosBase: 0,
        commissionPct: barber.commission,
        commissionAmount: 0,
        comisionProductos: 0,
      });
    });

    // Aggregate only active transactions, splitting amounts by payments array
    const activeTransactions = summary.transactions.filter(
      tx => tx.estado !== 'anulado' && !!tx.barberId
    );
    const txPayments = (tx: Transaction) =>
      tx.payments && tx.payments.length > 0
        ? tx.payments
        : [{ method: tx.paymentMethod, amount: tx.total }];

    activeTransactions.forEach(tx => {
      const barberId = tx.barberId as string;
      let existing = summaryMap.get(barberId);
      if (!existing) {
        const barberData = barbers.find(b => b.id === barberId);
        existing = {
          barberId,
          barberName: tx.barberName || '—',
          count: 0,
          totalEfectivo: 0,
          totalMercadoPago: 0,
          total: 0,
          productosTotal: 0,
          serviciosBase: 0,
          commissionPct: barberData?.commission || 0,
          commissionAmount: 0,
          comisionProductos: 0,
        };
        summaryMap.set(barberId, existing);
      }
      const serviceCount = tx.serviceCount ?? (tx.tipoVenta === 'productos' || !tx.serviceId ? 0 : 1);
      const serviciosBaseTx = tx.serviciosBase ?? (tx.tipoVenta === 'productos' ? 0 : tx.total);
      existing.count += serviceCount;
      existing.total += tx.total;
      existing.productosTotal += tx.productosTotal ?? 0;
      existing.serviciosBase += serviciosBaseTx;
      txPayments(tx).forEach(p => {
        if (p.method === 'efectivo') existing!.totalEfectivo += p.amount;
        else if (isDigitalMethod(p.method)) existing!.totalMercadoPago += p.amount;
      });
    });

    // Calculate commission amounts (sólo sobre serviciosBase)
    summaryMap.forEach(s => {
      s.commissionAmount = Math.round(s.serviciosBase * (s.commissionPct / 100));
    });

    return Array.from(summaryMap.values()).filter(s => s.count > 0 || s.productosTotal > 0);
  }, [summary.transactions, barbers]);

  // Comisión por productos en vivo (mismo helper que useCashClosing)
  const [comisionProductosByBarber, setComisionProductosByBarber] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!organization) {
        setComisionProductosByBarber({});
        return;
      }
      const activeTxs = summary.transactions.filter(tx => tx.estado !== 'anulado' && !!tx.barberId);
      const productoIds = new Set<string>();
      const barberoIds = new Set<string>();
      activeTxs.forEach(tx => {
        (tx.productos || []).forEach(p => p.producto_id && productoIds.add(p.producto_id));
        if ((tx.productos?.length || 0) > 0 && tx.barberId) barberoIds.add(tx.barberId);
      });
      if (productoIds.size === 0 || barberoIds.size === 0) {
        if (!cancelled) setComisionProductosByBarber({});
        return;
      }
      const [{ data: prodCfgRows }, { data: barberoCfgRows }] = await Promise.all([
        currentSucursal?.id
          ? supabase
              .from('productos_sucursal')
              .select('producto_id, comision_modo, comision_porcentaje, precio_costo')
              .eq('sucursal_id', currentSucursal.id)
              .in('producto_id', Array.from(productoIds))
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('comision_productos_config')
          .select('barbero_id, porcentaje, activa')
          .eq('organization_id', organization.id)
          .eq('activa', true)
          .in('barbero_id', Array.from(barberoIds)),
      ]);
      const prodCfgMap: Record<string, ProductoCfg> = {};
      (prodCfgRows || []).forEach((r: any) => {
        prodCfgMap[r.producto_id] = {
          comision_modo: (r.comision_modo as any) || 'barbero',
          comision_porcentaje: r.comision_porcentaje,
          precio_costo: r.precio_costo,
        };
      });
      const barberoCfgMap: Record<string, { porcentaje: number; activa: boolean }> = {};
      (barberoCfgRows || []).forEach((r: any) => {
        barberoCfgMap[r.barbero_id] = { porcentaje: Number(r.porcentaje) || 0, activa: !!r.activa };
      });
      const result: Record<string, number> = {};
      const byBarber = new Map<string, { producto_id: string; cantidad: number; precio_unitario: number }[]>();
      activeTxs.forEach(tx => {
        if (!tx.barberId || !tx.productos?.length) return;
        const arr = byBarber.get(tx.barberId) || [];
        tx.productos.forEach(p => arr.push({
          producto_id: p.producto_id,
          cantidad: p.cantidad,
          precio_unitario: p.precio_unitario,
        }));
        byBarber.set(tx.barberId, arr);
      });
      byBarber.forEach((items, barberoId) => {
        const { total } = calcComisionProductos(items, barberoCfgMap[barberoId] || null, prodCfgMap);
        result[barberoId] = total;
      });
      if (!cancelled) setComisionProductosByBarber(result);
    })();
    return () => { cancelled = true; };
  }, [summary.transactions, organization, currentSucursal]);

  const hayProductosConBarbero = useMemo(
    () => barberSummaries.some(b => (b.productosTotal ?? 0) > 0),
    [barberSummaries]
  );
  // Check if selected date is in the past (for backfill CTA)
  const isPastDate = useMemo(() => isBefore(startOfDay(validDate), startOfDay(new Date())), [validDate]);

  // Check which barbers are missing closings (for backfill)
  const barbersWithoutClosing = useMemo(() => 
    barbers.filter(b => !closedBarbers.has(b.id)),
    [barbers, closedBarbers]
  );

  // PIN-gated date navigation: require PIN for past dates
  const navigateToDate = useCallback((date: Date) => {
    if (isToday(date)) {
      onDateChange(date);
    } else if (requiresPin) {
      setPendingDate(date);
      setPinAction('pastDate');
      setPinGateOpen(true);
    } else {
      onDateChange(date);
    }
  }, [onDateChange, requiresPin]);

  const handlePreviousDay = () => navigateToDate(subDays(validDate, 1));
  const handleNextDay = () => {
    const next = addDays(validDate, 1);
    if (isToday(next)) {
      onDateChange(next);
    } else {
      navigateToDate(next);
    }
  };
  const handleToday = () => onDateChange(new Date());

  // PIN-gated cash closing
  const handleClosingClick = useCallback((barber: BarberSummary) => {
    if (requiresPin) {
      setPendingClosingBarber(barber);
      setPinAction('closing');
      setPinGateOpen(true);
    } else {
      setClosingBarber(barber);
    }
  }, [requiresPin]);

  // PIN-gated void closure
  const handleVoidClosureClick = useCallback((closureData: { id: number; barberName: string }) => {
    if (requiresPin) {
      setPendingVoidClosure(closureData);
      setPinAction('voidClosure');
      setPinGateOpen(true);
    } else {
      setVoidingClosure(closureData);
    }
  }, [requiresPin]);

  // PIN-gated history views
  const handleHistoryClick = useCallback(() => {
    if (requiresPin) {
      setPinAction('history');
      setPinGateOpen(true);
    } else {
      setHistoryOpen(true);
    }
  }, [requiresPin]);

  const handleAnulacionesHistoryClick = useCallback(() => {
    if (requiresPin) {
      setPinAction('anulacionesHistory');
      setPinGateOpen(true);
    } else {
      setAnulacionesHistoryOpen(true);
    }
  }, [requiresPin]);

  // Handle PIN validation result
  const handlePinValidate = useCallback(async (pin: string): Promise<{ success: boolean; userName?: string }> => {
    const result = await validatePin(pin);
    if (result.success) {
      setPinGateOpen(false);
      if (pinAction === 'closing' && pendingClosingBarber) {
        setClosingBarber(pendingClosingBarber);
        setPendingClosingBarber(null);
      } else if (pinAction === 'voidClosure' && pendingVoidClosure) {
        setVoidingClosure(pendingVoidClosure);
        setPendingVoidClosure(null);
      } else if (pinAction === 'pastDate' && pendingDate) {
        onDateChange(pendingDate);
        setPendingDate(null);
      } else if (pinAction === 'history') {
        setHistoryOpen(true);
      } else if (pinAction === 'anulacionesHistory') {
        setAnulacionesHistoryOpen(true);
      }
      setPinAction(null);
    }
    return result;
  }, [validatePin, pinAction, pendingClosingBarber, pendingVoidClosure, pendingDate, onDateChange]);

  const VOID_REASONS = [
    'Servicios duplicados o faltantes',
    'Se registraron ventas después del cierre',
    'Diferencia entre caja física y sistema detectada post-cierre',
    'Falla del sistema durante el cierre',
  ];

  // Handle voiding a cash closing
  const handleVoidClosure = async () => {
    if (!voidingClosure || !user || !organization || !voidReason) return;
    
    setIsVoidingClosure(true);
    try {
      // Update ingreso status to 'eliminado'
      const { error: updateError } = await supabase
        .from('ingresos')
        .update({ estado: 'eliminado' })
        .eq('id', voidingClosure.id);

      if (updateError) throw updateError;

      // Create anulacion record with reason
      const { error: insertError } = await supabase
        .from('anulaciones_cierre')
        .insert({
          ingreso_id: voidingClosure.id,
          barbero_nombre: voidingClosure.barberName,
          fecha_cierre: format(validDate, 'yyyy-MM-dd'),
          anulado_por_id: user.id,
          anulado_por_nombre: profile?.full_name || user.email || 'Usuario',
          anulado_por_email: user.email || '',
          organization_id: organization.id,
          motivo: voidReason,
        });

      if (insertError) throw insertError;

      toast.success('Cierre de caja anulado correctamente');
      setVoidingClosure(null);
      setVoidReason('');
      checkClosedBarbers(); // Refresh the closed barbers state
    } catch (error) {
      console.error('Error voiding closure:', error);
      toast.error('Error al anular el cierre de caja');
    } finally {
      setIsVoidingClosure(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cierre de Caja</h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">
            {format(validDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[140px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(validDate, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={validDate}
                onSelect={(date) => date && navigateToDate(date)}
                locale={es}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={handleNextDay} disabled={isToday(validDate)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday(validDate) && (
            <Button variant="secondary" size="sm" onClick={handleToday}>
              Hoy
            </Button>
          )}
          <MultiDayClosingSummary />
          <AnulacionesCierreHistory barbers={barbers} />
          <Button variant="outline" size="sm" onClick={handleHistoryClick}>
            <Clock className="h-4 w-4 mr-2" />
            Historial
          </Button>
          <CashClosingHistory barbers={barbers} externalOpen={historyOpen} onExternalOpenChange={setHistoryOpen} />
        </div>
      </div>

      {/* General Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total General</p>
                <p className="text-2xl font-bold text-foreground">${summary.total.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Efectivo</p>
                <p className="text-2xl font-bold text-success">${summary.totalEfectivo.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Digital</p>
                <p className="text-2xl font-bold text-secondary">${summary.totalMercadoPago.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Servicios</p>
                <p className="text-2xl font-bold text-foreground">{summary.count}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Receipt className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Barber Summaries */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          Cierre por Barbero
        </h2>

        {barberSummaries.length === 0 ? (
          <Card className="border border-border bg-card">
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <User className="h-10 w-10 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Sin actividad</p>
                <p className="text-sm mt-1">Los cierres por barbero aparecerán aquí</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {barberSummaries.map((barber) => (
              <Card key={barber.barberId} className="border border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {barber.barberName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {barber.barberName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Servicios
                    </span>
                    <span className="font-semibold text-foreground">{barber.count}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-success" />
                      Efectivo
                    </span>
                    <span className="font-semibold text-success">${barber.totalEfectivo.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-secondary" />
                      Digital
                    </span>
                    <span className="font-semibold text-secondary">${barber.totalMercadoPago.toLocaleString()}</span>
                  </div>
                  {hayProductosConBarbero && (
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        Productos
                      </span>
                      <span className="font-semibold text-foreground">${(barber.productosTotal || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {hayProductosConBarbero && (
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Comisión productos
                      </span>
                      <span className="font-semibold text-foreground">${(comisionProductosByBarber[barber.barberId] || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm font-medium text-foreground">Total</span>
                    <span className="text-lg font-bold text-foreground">${barber.total.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 bg-primary/5 -mx-6 px-6 py-3">
                    <span className="text-sm font-medium text-primary flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Comisión ({barber.commissionPct}%)
                    </span>
                    <span className="text-lg font-bold text-primary">${barber.commissionAmount.toLocaleString()}</span>
                  </div>
                  <div className="-mx-6 px-6 pb-4 pt-3">
                    {closedBarbers.has(barber.barberId) ? (
                      canVoidClosure ? (
                        <Button 
                          variant="destructive"
                          className="w-full" 
                          onClick={() => {
                            const closureData = closedBarbersData.get(barber.barberId);
                            if (closureData) {
                              handleVoidClosureClick(closureData);
                            }
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Anular Cierre
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="w-full justify-center py-2">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Caja Cerrada
                        </Badge>
                      )
                    ) : isPastDate ? (
                      <Badge variant="outline" className="w-full justify-center py-2 text-muted-foreground">
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Usá "Regularizar día" para cerrar
                      </Badge>
                    ) : (
                      <Button 
                        className="w-full" 
                        onClick={() => handleClosingClick(barber)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Cerrar Caja
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Backfill CTA - show when past date and barbers without closing */}
      {isPastDate && canBackfill && barbersWithoutClosing.length > 0 && (
        <Card className="border border-dashed border-primary/40 bg-primary/5">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarClock className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium text-foreground">
                    {barbersWithoutClosing.length} barbero{barbersWithoutClosing.length > 1 ? 's' : ''} sin cierre de caja
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Podés cargar el cierre de forma diferida para este día
                  </p>
                </div>
              </div>
              <Button onClick={() => setBackfillOpen(true)}>
                <CalendarClock className="h-4 w-4 mr-2" />
                Regularizar día
                <Badge variant="secondary" className="ml-2 text-xs">Diferido</Badge>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Transacciones del Día
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Sin transacciones</p>
              <p className="text-sm mt-1">Los cobros aparecerán aquí</p>
            </div>
          ) : (
            <TooltipProvider>
              <div className="space-y-2">
                {summary.transactions.map((tx) => {
                  const isVoided = tx.estado === 'anulado';
                  const canVoid = !isVoided && canVoidTransaction(tx);
                  const txPayments = tx.payments && tx.payments.length > 0
                    ? tx.payments
                    : [{ method: tx.paymentMethod, amount: tx.total }];
                  const isMixed = txPayments.length > 1 && txPayments.every(p => p.amount > 0);
                  const efectivoAmt = txPayments.filter(p => p.method === 'efectivo').reduce((s, p) => s + p.amount, 0);
                  const mpAmt = txPayments.filter(p => isDigitalMethod(p.method)).reduce((s, p) => s + p.amount, 0);

                  return (
                    <div
                      key={tx.id}
                      className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                        isVoided 
                          ? 'bg-destructive/10 border border-destructive/20' 
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {isVoided ? (
                          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <Ban className="h-4 w-4 text-destructive" />
                          </div>
                        ) : isMixed ? (
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center gap-0.5">
                            <Banknote className="h-3 w-3 text-success" />
                            <CreditCard className="h-3 w-3 text-secondary" />
                          </div>
                        ) : tx.paymentMethod === 'efectivo' ? (
                          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                            <Banknote className="h-4 w-4 text-success" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-secondary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${isVoided ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                            {tx.serviceName || (tx.productos && tx.productos.length > 0 ? 'Venta de productos' : '—')}
                          </span>
                          {tx.extras.length > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                              +{tx.extras.length}
                            </span>
                          )}
                          {isMixed && !isVoided && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              Mixto
                            </Badge>
                          )}
                          {isVoided && (
                            <Badge variant="destructive" className="text-xs">
                              Anulado
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm ${isVoided ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                          {(tx.barberName || '—')} • {format(new Date(tx.createdAt), 'HH:mm')}
                          {isMixed && !isVoided && (
                            <span className="ml-2">
                              • <span className="text-success">Ef. ${efectivoAmt.toLocaleString()}</span> / <span className="text-secondary">Dig. ${mpAmt.toLocaleString()}</span>
                            </span>
                          )}
                          {isVoided && tx.anuladoPor && (
                            <span className="ml-2 text-destructive">• Anulado por {tx.anuladoPor}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`font-semibold ${isVoided ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                            ${tx.total.toLocaleString()}
                          </p>
                          {tx.discount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              -{tx.discount}%
                            </p>
                          )}
                        </div>
                        {!isVoided && onVoidTransaction && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className={`h-8 w-8 border-destructive/30 ${canVoid ? 'text-destructive hover:text-destructive hover:bg-destructive/10' : 'text-muted-foreground/50 cursor-not-allowed opacity-50'}`}
                                onClick={() => canVoid && setVoidingTransaction(tx)}
                                disabled={!canVoid}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {canVoid 
                                ? 'Anular transacción' 
                                : 'No se puede anular: caja cerrada'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Void Transaction Dialog */}
      <VoidTransactionDialog
        open={!!voidingTransaction}
        onOpenChange={(open) => !open && setVoidingTransaction(null)}
        transaction={voidingTransaction}
        onVoidComplete={async (transactionId, voidedBy, voidedById) => {
          if (onVoidTransaction) {
            await onVoidTransaction(transactionId, voidedBy, voidedById);
            checkClosedBarbers(); // Refresh closed barbers
          }
        }}
      />

      {/* Cash Closing Dialog */}
      <Dialog open={!!closingBarber} onOpenChange={(open) => !open && setClosingBarber(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Cierre de Caja - {closingBarber?.barberName}
            </DialogTitle>
            <p className="text-sm text-muted-foreground capitalize">
              {format(validDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                <p className="text-sm text-muted-foreground">Efectivo</p>
                <p className="text-xl font-bold text-success">${closingBarber?.totalEfectivo.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{barberTransactions.efectivo.length} servicios</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/20">
                <p className="text-sm text-muted-foreground">Digital</p>
                <p className="text-xl font-bold text-secondary">${closingBarber?.totalMercadoPago.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{barberTransactions.digital.length} servicios</p>
              </div>
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground">Comisión ({closingBarber?.commissionPct}%)</p>
                <p className="text-xl font-bold text-primary">${closingBarber?.commissionAmount.toLocaleString()}</p>
              </div>
            </div>

            {/* Efectivo Transactions */}
            {barberTransactions.efectivo.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-success" />
                  Efectivo ({barberTransactions.efectivo.length})
                </h4>
                <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                  {barberTransactions.efectivo.map((tx) => {
                    const pagos = tx.payments && tx.payments.length > 0
                      ? tx.payments
                      : [{ method: tx.paymentMethod, amount: tx.total }];
                    const amt = pagos.filter(p => p.method === 'efectivo').reduce((s, p) => s + p.amount, 0);
                    const isMixed = pagos.length > 1 && pagos.every(p => p.amount > 0);
                    return (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <span className="font-medium text-sm">{tx.serviceName || (tx.productos && tx.productos.length > 0 ? "Venta de productos" : "—")}</span>
                          {tx.extras.length > 0 && (
                            <span className="text-xs ml-2 text-muted-foreground">
                              + {tx.extras.map(e => e.name).join(', ')}
                            </span>
                          )}
                          {isMixed && (
                            <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4">Parte de mixto</Badge>
                          )}
                          <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), 'HH:mm')}</p>
                        </div>
                        <span className="font-semibold text-success">${amt.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Digital Transactions */}
            {barberTransactions.digital.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-secondary" />
                  Digital ({barberTransactions.digital.length})
                </h4>
                <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                  {barberTransactions.digital.map((tx) => {
                    const pagos = tx.payments && tx.payments.length > 0
                      ? tx.payments
                      : [{ method: tx.paymentMethod, amount: tx.total }];
                    const amt = pagos.filter(p => isDigitalMethod(p.method)).reduce((s, p) => s + p.amount, 0);
                    const isMixed = pagos.length > 1 && pagos.every(p => p.amount > 0);
                    return (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <span className="font-medium text-sm">{tx.serviceName || (tx.productos && tx.productos.length > 0 ? "Venta de productos" : "—")}</span>
                          {tx.extras.length > 0 && (
                            <span className="text-xs ml-2 text-muted-foreground">
                              + {tx.extras.map(e => e.name).join(', ')}
                            </span>
                          )}
                          {isMixed && (
                            <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4">Parte de mixto</Badge>
                          )}
                          <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), 'HH:mm')}</p>
                        </div>
                        <span className="font-semibold text-secondary">${amt.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Total Summary */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
              <span className="font-medium">Total General</span>
              <span className="text-2xl font-bold">${closingBarber?.total.toLocaleString()}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClosingBarber(null)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button 
              disabled={isSaving}
              onClick={async () => {
                if (!closingBarber) return;
                setIsSaving(true);
                const success = await saveCashClosing({
                  barber: closingBarber,
                  transactions: summary.transactions,
                  date: validDate,
                  lines,
                });
                setIsSaving(false);
                if (success) {
                  setClosingBarber(null);
                  checkClosedBarbers(); // Refresh to update button state
                }
              }}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {isSaving ? 'Guardando...' : 'Confirmar Cierre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Closure Confirmation Dialog */}
      <Dialog open={!!voidingClosure} onOpenChange={(open) => {
        if (!open) {
          setVoidingClosure(null);
          setVoidReason('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Anular Cierre de Caja
            </DialogTitle>
            <DialogDescription>
              Esta acción anulará el cierre de caja de <span className="font-semibold">{voidingClosure?.barberName}</span> para el día{' '}
              <span className="font-semibold">{format(validDate, "d 'de' MMMM yyyy", { locale: es })}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="void-reason" className="text-sm font-medium">
                Motivo de la anulación <span className="text-destructive">*</span>
              </Label>
              <Select value={voidReason} onValueChange={setVoidReason}>
                <SelectTrigger id="void-reason">
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {VOID_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Al anular el cierre:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                <li>El registro se marcará como eliminado</li>
                <li>Se guardará un registro de quién realizó la anulación</li>
                <li>El barbero podrá realizar un nuevo cierre de caja</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setVoidingClosure(null); setVoidReason(''); }} disabled={isVoidingClosure}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              disabled={isVoidingClosure || !voidReason}
              onClick={handleVoidClosure}
            >
              {isVoidingClosure ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {isVoidingClosure ? 'Anulando...' : 'Confirmar Anulación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backfill Wizard */}
      <BackfillWizard
        open={backfillOpen}
        onOpenChange={setBackfillOpen}
        date={validDate}
        barbers={barbers}
        services={services}
        lines={lines}
        closedBarberIds={closedBarbers}
        onComplete={checkClosedBarbers}
      />

      {/* PIN Gate Dialog */}
      <PinGateDialog
        open={pinGateOpen}
        onValidate={handlePinValidate}
        onClose={() => {
          setPinGateOpen(false);
          setPinAction(null);
          setPendingClosingBarber(null);
          setPendingVoidClosure(null);
          setPendingDate(null);
        }}
        sectionName={
          pinAction === 'closing' ? 'el cierre de caja' :
          pinAction === 'voidClosure' ? 'anular el cierre' :
          pinAction === 'pastDate' ? 'ver resúmenes anteriores' :
          pinAction === 'history' ? 'el historial de cierres' :
          pinAction === 'anulacionesHistory' ? 'el historial de anulaciones' :
          'esta acción'
        }
      />
    </div>
  );
}
