import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Barber, Service, Line } from '@/types/barbershop';
import { useBackfillClosing, BackfillServiceItem, BackfillQuickData } from '@/hooks/useBackfillClosing';
import { 
  CalendarClock, User, FileText, Package, Eye, CheckCircle, 
  Loader2, ChevronLeft, ChevronRight, Banknote, CreditCard, Plus, Minus 
} from 'lucide-react';

interface BackfillWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  barbers: Barber[];
  services: Service[];
  lines: Line[];
  closedBarberIds: Set<string>;
  onComplete: () => void;
}

const BACKFILL_REASONS = [
  'Olvidé cerrar la caja',
  'No se trabajó con el sistema ese día',
  'Falla del sistema',
  'Carga inicial de datos históricos',
  'Corrección de registros',
];

const STEPS = [
  { icon: User, label: 'Barbero' },
  { icon: FileText, label: 'Motivo' },
  { icon: Package, label: 'Servicios' },
  { icon: Eye, label: 'Resumen' },
  { icon: CheckCircle, label: 'Confirmar' },
];

export function BackfillWizard({ open, onOpenChange, date, barbers, services, lines, closedBarberIds, onComplete }: BackfillWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [loadMode, setLoadMode] = useState<'detailed' | 'quick'>('quick');
  const [items, setItems] = useState<BackfillServiceItem[]>([]);
  const [quickData, setQuickData] = useState<BackfillQuickData>({ totalEfectivo: 0, totalMercadoPago: 0, cantidadServicios: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const { saveBackfill } = useBackfillClosing();

  // Available barbers (not yet closed)
  const availableBarbers = useMemo(() => 
    barbers.filter(b => !closedBarberIds.has(b.id)),
    [barbers, closedBarberIds]
  );

  const selectedBarber = useMemo(() => 
    barbers.find(b => b.id === selectedBarberId),
    [barbers, selectedBarberId]
  );

  // Active services for detailed mode
  const activeServices = useMemo(() => 
    services.filter(s => s.active),
    [services]
  );

  // Initialize items when switching to detailed mode
  const initDetailedItems = () => {
    if (items.length === 0) {
      setItems(activeServices.map(s => ({
        servicioId: s.id,
        servicioNombre: s.name,
        lineaId: s.lineId || null,
        qty: 0,
        unitPrice: s.price,
        paymentMethod: 'efectivo' as const,
      })));
    }
  };

  // Calculated totals
  const totals = useMemo(() => {
    if (loadMode === 'quick') {
      const total = quickData.totalEfectivo + quickData.totalMercadoPago;
      const commission = selectedBarber ? Math.round(total * (selectedBarber.commission / 100)) : 0;
      return { efectivo: quickData.totalEfectivo, mp: quickData.totalMercadoPago, total, services: quickData.cantidadServicios, commission };
    }
    let efectivo = 0, mp = 0, serviceCount = 0;
    items.forEach(item => {
      if (item.qty > 0) {
        const subtotal = item.qty * item.unitPrice;
        if (item.paymentMethod === 'efectivo') efectivo += subtotal;
        else mp += subtotal;
        serviceCount += item.qty;
      }
    });
    const total = efectivo + mp;
    const commission = selectedBarber ? Math.round(total * (selectedBarber.commission / 100)) : 0;
    return { efectivo, mp, total, services: serviceCount, commission };
  }, [loadMode, quickData, items, selectedBarber]);

  const canAdvance = () => {
    switch (step) {
      case 0: return !!selectedBarberId;
      case 1: return !!reason;
      case 2: return totals.total > 0 || totals.services > 0;
      case 3: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step === 2 && loadMode === 'detailed') initDetailedItems();
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleConfirm = async () => {
    if (!selectedBarber) return;
    setIsSaving(true);
    const success = await saveBackfill({
      barberId: selectedBarberId,
      barberName: `${selectedBarber.firstName} ${selectedBarber.lastName}`.trim(),
      commissionPct: selectedBarber.commission,
      date,
      reason,
      note,
      mode: loadMode,
      items: loadMode === 'detailed' ? items.filter(i => i.qty > 0) : [],
      quickData: loadMode === 'quick' ? quickData : null,
    });
    setIsSaving(false);
    if (success) {
      resetAndClose();
      onComplete();
    }
  };

  const resetAndClose = () => {
    setStep(0);
    setSelectedBarberId('');
    setReason('');
    setNote('');
    setLoadMode('quick');
    setItems([]);
    setQuickData({ totalEfectivo: 0, totalMercadoPago: 0, cantidadServicios: 0 });
    onOpenChange(false);
  };

  const updateItemQty = (index: number, delta: number) => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, qty: Math.max(0, item.qty + delta) } : item
    ));
  };

  const updateItemPayment = (index: number, method: 'efectivo' | 'mercado_pago') => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, paymentMethod: method } : item
    ));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Regularizar Día
            <Badge variant="secondary" className="ml-2 text-xs">Diferido</Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground capitalize">
            {format(date, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 py-3 border-b border-border">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                i === step ? 'bg-primary text-primary-foreground' : 
                i < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                <s.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[300px]">
          {/* Step 0: Select barber */}
          {step === 0 && (
            <div className="space-y-4">
              <Label className="text-sm font-medium">Seleccionar barbero</Label>
              {availableBarbers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Todos los barberos ya tienen cierre para este día.</p>
              ) : (
                <div className="grid gap-2">
                  {availableBarbers.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBarberId(b.id)}
                      className={`flex items-center gap-3 p-4 rounded-lg border transition-colors text-left ${
                        selectedBarberId === b.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {b.firstName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{b.firstName} {b.lastName}</p>
                        <p className="text-sm text-muted-foreground">Comisión: {b.commission}%</p>
                      </div>
                      {selectedBarberId === b.id && (
                        <CheckCircle className="h-5 w-5 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Reason */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Motivo del cierre diferido <span className="text-destructive">*</span></Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKFILL_REASONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nota adicional (opcional)</Label>
                <Textarea 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)} 
                  placeholder="Detalle adicional sobre el cierre..."
                  maxLength={500}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 2: Service loading */}
          {step === 2 && (
            <div className="space-y-4">
              <Tabs value={loadMode} onValueChange={(v) => {
                setLoadMode(v as 'detailed' | 'quick');
                if (v === 'detailed') initDetailedItems();
              }}>
                <TabsList className="w-full">
                  <TabsTrigger value="quick" className="flex-1">Carga rápida</TabsTrigger>
                  <TabsTrigger value="detailed" className="flex-1">Por servicio</TabsTrigger>
                </TabsList>

                <TabsContent value="quick" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-1.5">
                        <Banknote className="h-4 w-4 text-success" /> Total Efectivo
                      </Label>
                      <CurrencyInput
                        value={quickData.totalEfectivo ? String(quickData.totalEfectivo) : ''}
                        onChange={(v) => setQuickData(prev => ({ ...prev, totalEfectivo: Number(v) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4 text-secondary" /> Total Mercado Pago
                      </Label>
                      <CurrencyInput
                        value={quickData.totalMercadoPago ? String(quickData.totalMercadoPago) : ''}
                        onChange={(v) => setQuickData(prev => ({ ...prev, totalMercadoPago: Number(v) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Cantidad de servicios</Label>
                    <Input
                       type="number"
                       inputMode="numeric"
                       min={0}
                       value={quickData.cantidadServicios || ''}
                      onChange={(e) => setQuickData(prev => ({ ...prev, cantidadServicios: Number(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="detailed" className="space-y-2 mt-4">
                  <p className="text-xs text-muted-foreground mb-3">Indicá cantidad y método de pago por cada servicio realizado.</p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {items.map((item, idx) => {
                      const line = lines.find(l => l.id === item.lineaId);
                      return (
                        <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${item.qty > 0 ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{item.servicioNombre}</span>
                              {line && <Badge variant="outline" className="text-xs shrink-0">{line.name}</Badge>}
                            </div>
                            <span className="text-xs text-muted-foreground">${item.unitPrice.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Select 
                              value={item.paymentMethod} 
                              onValueChange={(v) => updateItemPayment(idx, v as 'efectivo' | 'mercado_pago')}
                            >
                              <SelectTrigger className="w-[100px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="efectivo">Efectivo</SelectItem>
                                <SelectItem value="mercado_pago">MP</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQty(idx, -1)} disabled={item.qty === 0}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQty(idx, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Resumen del cierre diferido</h3>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Barbero</span>
                    <span className="font-medium">{selectedBarber?.firstName} {selectedBarber?.lastName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Motivo</span>
                    <span className="text-sm">{reason}</span>
                  </div>
                  {note && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Nota</span>
                      <span className="text-sm text-right max-w-[60%]">{note}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-center">
                        <p className="text-xs text-muted-foreground">Efectivo</p>
                        <p className="text-lg font-bold text-success">${totals.efectivo.toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-center">
                        <p className="text-xs text-muted-foreground">Mercado Pago</p>
                        <p className="text-lg font-bold text-secondary">${totals.mp.toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                        <p className="text-xs text-muted-foreground">Comisión ({selectedBarber?.commission}%)</p>
                        <p className="text-lg font-bold text-primary">${totals.commission.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                      <span className="font-medium">Total</span>
                      <span className="text-xl font-bold">${totals.total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Servicios</span>
                      <span>{totals.services}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Modo de carga</span>
                      <Badge variant="outline">{loadMode === 'quick' ? 'Carga rápida' : 'Por servicio'}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="text-center space-y-4 py-8">
              <CalendarClock className="h-12 w-12 mx-auto text-primary" />
              <div>
                <p className="font-medium text-lg">¿Confirmar cierre diferido?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Se registrará un cierre de caja para <strong>{selectedBarber?.firstName} {selectedBarber?.lastName}</strong> con fecha comercial del{' '}
                  <strong>{format(date, "d 'de' MMMM", { locale: es })}</strong>.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Este cierre se marcará como "diferido" y quedará registrado quién y cuándo lo realizó.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4">
          {step > 0 && (
            <Button variant="outline" onClick={handleBack} disabled={isSaving}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canAdvance()}>
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {isSaving ? 'Guardando...' : 'Confirmar Cierre Diferido'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
