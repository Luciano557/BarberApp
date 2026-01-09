import { Banknote, CreditCard, Receipt, TrendingUp, Clock, User, ChevronLeft, ChevronRight, CalendarIcon, Percent, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Transaction, Barber, Line } from '@/types/barbershop';
import { format, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { useCashClosing } from '@/hooks/useCashClosing';
import { CashClosingHistory } from './CashClosingHistory';

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

export function DailySummary({ summary, barbers, lines, selectedDate, onDateChange }: DailySummaryProps) {
  const [closingBarber, setClosingBarber] = useState<BarberSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { saveCashClosing } = useCashClosing();
  
  // Ensure selectedDate is a valid Date
  const validDate = selectedDate instanceof Date && !isNaN(selectedDate.getTime()) 
    ? selectedDate 
    : new Date();

  // Get transactions for selected barber
  const barberTransactions = useMemo(() => {
    if (!closingBarber) return { efectivo: [], mercadoPago: [] };
    
    const efectivo = summary.transactions.filter(
      tx => tx.barberId === closingBarber.barberId && tx.paymentMethod === 'efectivo'
    );
    const mercadoPago = summary.transactions.filter(
      tx => tx.barberId === closingBarber.barberId && tx.paymentMethod === 'mercado_pago'
    );
    
    return { efectivo, mercadoPago };
  }, [closingBarber, summary.transactions]);

  // Calculate per-barber summaries with commissions
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

    // Aggregate transactions
    summary.transactions.forEach(tx => {
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
                    <Button 
                      className="w-full" 
                      onClick={() => setClosingBarber(barber)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Cerrar Caja
                    </Button>
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
            <div className="space-y-2">
              {summary.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-shrink-0">
                    {tx.paymentMethod === 'efectivo' ? (
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
                      <span className="font-medium text-foreground">{tx.serviceName}</span>
                      {tx.extras.length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                          +{tx.extras.length}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tx.barberName} • {format(new Date(tx.createdAt), 'HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">${tx.total.toLocaleString()}</p>
                    {tx.discount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        -{tx.discount}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
