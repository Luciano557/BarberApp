import { Banknote, CreditCard, Receipt, TrendingUp, Clock, User, ChevronLeft, ChevronRight, CalendarIcon, Percent, CheckCircle, Loader2, Trash2, Ban, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Transaction, Barber, Line } from '@/types/barbershop';
import { format, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useState, useCallback } from 'react';
import { useCashClosing } from '@/hooks/useCashClosing';
import { CashClosingHistory } from './CashClosingHistory';
import { AnulacionesCierreHistory } from './AnulacionesCierreHistory';
import { VoidTransactionDialog } from './VoidTransactionDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
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
  commissionPct: number;
  commissionAmount: number;
}

export function DailySummary({ summary, barbers, lines, selectedDate, onDateChange, onVoidTransaction }: DailySummaryProps) {
  const [closingBarber, setClosingBarber] = useState<BarberSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { saveCashClosing } = useCashClosing();
  const [voidingTransaction, setVoidingTransaction] = useState<Transaction | null>(null);
  const [closedBarbers, setClosedBarbers] = useState<Set<string>>(new Set());
  const [closedBarbersData, setClosedBarbersData] = useState<Map<string, { id: number; barberName: string }>>(new Map());
  const [voidingClosure, setVoidingClosure] = useState<{ id: number; barberName: string } | null>(null);
  const [isVoidingClosure, setIsVoidingClosure] = useState(false);
  const [voidReason, setVoidReason] = useState<string>('');
  const { user, profile, isOwner, isManager } = useAuth();
  const canVoidClosure = isOwner || isManager;
  const { organization } = useOrganization();
  const validDate = selectedDate instanceof Date && !isNaN(selectedDate.getTime()) 
    ? selectedDate 
    : new Date();

  // Get transactions for selected barber (only active transactions)
  const barberTransactions = useMemo(() => {
    if (!closingBarber) return { efectivo: [], mercadoPago: [] };
    
    const activeTransactions = summary.transactions.filter(tx => tx.estado !== 'anulado');
    const efectivo = activeTransactions.filter(
      tx => tx.barberId === closingBarber.barberId && tx.paymentMethod === 'efectivo'
    );
    const mercadoPago = activeTransactions.filter(
      tx => tx.barberId === closingBarber.barberId && tx.paymentMethod === 'mercado_pago'
    );
    
    return { efectivo, mercadoPago };
  }, [closingBarber, summary.transactions]);

  // Check which barbers have their cash closed for the selected date
  const checkClosedBarbers = useCallback(async () => {
    const startStr = getStartOfDayLocal(validDate);
    const endStr = getEndOfDayLocal(validDate);
    
    const { data } = await supabase
      .from('ingresos')
      .select('id, barbero')
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .neq('estado', 'eliminado');

    if (data) {
      const closedNames = new Set(data.map(d => d.barbero));
      setClosedBarbers(closedNames);
      
      // Store the mapping of barber name to ingreso id for voiding
      const dataMap = new Map<string, { id: number; barberName: string }>();
      data.forEach(d => {
        if (d.barbero) {
          dataMap.set(d.barbero, { id: d.id, barberName: d.barbero });
        }
      });
      setClosedBarbersData(dataMap);
    }
  }, [validDate]);

  // Check closed barbers on date change
  useMemo(() => {
    checkClosedBarbers();
  }, [checkClosedBarbers]);

  // Check if a transaction can be voided (barber's cash not closed)
  const canVoidTransaction = useCallback((tx: Transaction): boolean => {
    return !closedBarbers.has(tx.barberName);
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
        commissionPct: barber.commission,
        commissionAmount: 0,
      });
    });

    // Aggregate only active transactions
    const activeTransactions = summary.transactions.filter(tx => tx.estado !== 'anulado');
    activeTransactions.forEach(tx => {
      const existing = summaryMap.get(tx.barberId);
      if (existing) {
        existing.count += 1;
        existing.total += tx.total;
        if (tx.paymentMethod === 'efectivo') {
          existing.totalEfectivo += tx.total;
        } else {
          existing.totalMercadoPago += tx.total;
        }
      } else {
        // Handle transactions from barbers not in current list
        const barberData = barbers.find(b => b.id === tx.barberId);
        summaryMap.set(tx.barberId, {
          barberId: tx.barberId,
          barberName: tx.barberName,
          count: 1,
          totalEfectivo: tx.paymentMethod === 'efectivo' ? tx.total : 0,
          totalMercadoPago: tx.paymentMethod === 'mercado_pago' ? tx.total : 0,
          total: tx.total,
          commissionPct: barberData?.commission || 0,
          commissionAmount: 0,
        });
      }
    });

    // Calculate commission amounts
    summaryMap.forEach(summary => {
      summary.commissionAmount = Math.round(summary.total * (summary.commissionPct / 100));
    });

    return Array.from(summaryMap.values()).filter(s => s.count > 0);
  }, [summary.transactions, barbers]);

  const handlePreviousDay = () => onDateChange(subDays(validDate, 1));
  const handleNextDay = () => onDateChange(addDays(validDate, 1));
  const handleToday = () => onDateChange(new Date());

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
                onSelect={(date) => date && onDateChange(date)}
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
          <AnulacionesCierreHistory barbers={barbers} />
          <CashClosingHistory barbers={barbers} />
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
                <p className="text-sm text-muted-foreground">Mercado Pago</p>
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
                      Mercado Pago
                    </span>
                    <span className="font-semibold text-secondary">${barber.totalMercadoPago.toLocaleString()}</span>
                  </div>
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
                    {closedBarbers.has(barber.barberName) ? (
                      canVoidClosure ? (
                        <Button 
                          variant="destructive"
                          className="w-full" 
                          onClick={() => {
                            const closureData = closedBarbersData.get(barber.barberName);
                            if (closureData) {
                              setVoidingClosure(closureData);
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
                    ) : (
                      <Button 
                        className="w-full" 
                        onClick={() => setClosingBarber(barber)}
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
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isVoided ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                            {tx.serviceName}
                          </span>
                          {tx.extras.length > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                              +{tx.extras.length}
                            </span>
                          )}
                          {isVoided && (
                            <Badge variant="destructive" className="text-xs">
                              Anulado
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm ${isVoided ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                          {tx.barberName} • {format(new Date(tx.createdAt), 'HH:mm')}
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
                <p className="text-sm text-muted-foreground">Mercado Pago</p>
                <p className="text-xl font-bold text-secondary">${closingBarber?.totalMercadoPago.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{barberTransactions.mercadoPago.length} servicios</p>
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
                  {barberTransactions.efectivo.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <span className="font-medium text-sm">{tx.serviceName}</span>
                        {tx.extras.length > 0 && (
                          <span className="text-xs ml-2 text-muted-foreground">
                            + {tx.extras.map(e => e.name).join(', ')}
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), 'HH:mm')}</p>
                      </div>
                      <span className="font-semibold text-success">${tx.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mercado Pago Transactions */}
            {barberTransactions.mercadoPago.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-secondary" />
                  Mercado Pago ({barberTransactions.mercadoPago.length})
                </h4>
                <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                  {barberTransactions.mercadoPago.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <span className="font-medium text-sm">{tx.serviceName}</span>
                        {tx.extras.length > 0 && (
                          <span className="text-xs ml-2 text-muted-foreground">
                            + {tx.extras.map(e => e.name).join(', ')}
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), 'HH:mm')}</p>
                      </div>
                      <span className="font-semibold text-secondary">${tx.total.toLocaleString()}</span>
                    </div>
                  ))}
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
    </div>
  );
}
