import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Barber, Service, Line } from '@/types/barbershop';
import { useBackfillClosing, BackfillServiceItem, BackfillQuickData } from '@/hooks/useBackfillClosing';
import {
  CalendarClock, User, FileText, Package, Eye, CheckCircle,
  Loader2, ChevronLeft, ChevronRight, Banknote, CreditCard, Plus, Minus, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GridItem {
  servicioId: string;
  servicioNombre: string;
  lineaId: string | null;
  unitPrice: number;
  qtyEfectivo: number;
  qtyDigital: number;
}

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

export function BackfillWizard({ open, onOpenChange, date, barbers, services, lines: _lines, closedBarberIds, onComplete }: BackfillWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [loadMode, setLoadMode] = useState<'detailed' | 'quick'>('quick');
  const [items, setItems] = useState<GridItem[]>([]);
  const [quickData, setQuickData] = useState<BackfillQuickData>({ totalEfectivo: 0, totalMercadoPago: 0, cantidadServicios: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const { saveBackfill } = useBackfillClosing();

  const availableBarbers = useMemo(() =>
    barbers.filter(b => !closedBarberIds.has(b.id)),
    [barbers, closedBarberIds]
  );

  const selectedBarber = useMemo(() =>
    barbers.find(b => b.id === selectedBarberId),
    [barbers, selectedBarberId]
  );

  const activeServices = useMemo(() =>
    services.filter(s => s.active),
    [services]
  );

  const initDetailedItems = () => {
    if (items.length === 0) {
      setItems(activeServices.map(s => ({
        servicioId: s.id,
        servicioNombre: s.name,
        lineaId: s.lineId || null,
        unitPrice: s.price,
        qtyEfectivo: 0,
        qtyDigital: 0,
      })));
    }
  };

  const totals = useMemo(() => {
    if (loadMode === 'quick') {
      const total = quickData.totalEfectivo + quickData.totalMercadoPago;
      const commission = selectedBarber ? Math.round(total * (selectedBarber.commission / 100)) : 0;
      return { efectivo: quickData.totalEfectivo, mp: quickData.totalMercadoPago, total, services: quickData.cantidadServicios, commission };
    }
    let efectivo = 0, mp = 0, serviceCount = 0;
    items.forEach(item => {
      efectivo += item.qtyEfectivo * item.unitPrice;
      mp += item.qtyDigital * item.unitPrice;
      serviceCount += item.qtyEfectivo + item.qtyDigital;
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

  const toBackfillItems = (grid: GridItem[]): BackfillServiceItem[] =>
    grid.flatMap(item => {
      const out: BackfillServiceItem[] = [];
      if (item.qtyEfectivo > 0)
        out.push({ servicioId: item.servicioId, servicioNombre: item.servicioNombre, lineaId: item.lineaId, qty: item.qtyEfectivo, unitPrice: item.unitPrice, paymentMethod: 'efectivo' });
      if (item.qtyDigital > 0)
        out.push({ servicioId: item.servicioId, servicioNombre: item.servicioNombre, lineaId: item.lineaId, qty: item.qtyDigital, unitPrice: item.unitPrice, paymentMethod: 'mercado_pago' });
      return out;
    });

  const updateGridQty = (idx: number, method: 'efectivo' | 'digital', delta: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (method === 'efectivo') return { ...item, qtyEfectivo: Math.max(0, item.qtyEfectivo + delta) };
      return { ...item, qtyDigital: Math.max(0, item.qtyDigital + delta) };
    }));
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
      items: loadMode === 'detailed' ? toBackfillItems(items.filter(i => i.qtyEfectivo > 0 || i.qtyDigital > 0)) : [],
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

  return (
    <Sheet open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <SheetContent
        side="right"
        className={cn(
          "flex flex-col p-0 gap-0",
          step === 2 && loadMode === 'detailed' ? "sm:max-w-3xl" : "sm:max-w-2xl"
        )}
      >
        {/* Header */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b pr-12">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Regularizar Día</h2>
            <Badge variant="secondary" className="ml-1 text-xs">Diferido</Badge>
          </div>
          <p className="text-sm text-muted-foreground capitalize mt-1">
            {format(date, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>

        {/* Stepper */}
        <div className="shrink-0 px-6 py-3 border-b">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  i < step  && "bg-primary/10 text-primary",
                  i === step && "bg-primary text-primary-foreground",
                  i > step  && "bg-muted text-muted-foreground"
                )}>
                  {i < step
                    ? <Check className="h-3.5 w-3.5" />
                    : <s.icon className="h-3.5 w-3.5" />
                  }
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-border")} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-[300px]">

          {/* Step 0 — Barbero */}
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
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border transition-colors text-left",
                        selectedBarberId === b.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {b.firstName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{b.firstName} {b.lastName}</p>
                        <p className="text-sm text-muted-foreground">Comisión: {b.commission}%</p>
                      </div>
                      {selectedBarberId === b.id && (
                        <CheckCircle className="h-5 w-5 text-primary ml-auto shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 1 — Motivo */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Motivo del cierre diferido <span className="text-destructive">*</span>
                </Label>
                <div className="grid gap-2">
                  {BACKFILL_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={cn(
                        "flex items-center gap-3 w-full p-4 rounded-lg border text-left text-sm transition-colors",
                        reason === r
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded-full border-2 shrink-0 transition-colors",
                        reason === r ? "border-primary bg-primary" : "border-muted-foreground/40"
                      )} />
                      {r}
                    </button>
                  ))}
                </div>
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

          {/* Step 2 — Servicios */}
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
                        <CreditCard className="h-4 w-4 text-status-info-foreground" /> Total Digital
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

                <TabsContent value="detailed" className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">Indicá cantidad por método de pago para cada servicio realizado.</p>

                  {/* Desktop: tabla */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[480px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4 w-[45%]">Servicio</th>
                          <th className="py-2 w-[27.5%]">
                            <span className="flex items-center justify-center gap-1 text-xs font-medium text-success">
                              <Banknote className="h-3.5 w-3.5" /> Efectivo
                            </span>
                          </th>
                          <th className="py-2 w-[27.5%]">
                            <span className="flex items-center justify-center gap-1 text-xs font-medium text-status-info-foreground">
                              <CreditCard className="h-3.5 w-3.5" /> Digital
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-b border-border/40">
                            <td className="py-3 pr-4">
                              <span className="text-sm font-medium">{item.servicioNombre}</span>
                              <span className="text-xs text-muted-foreground block">${item.unitPrice.toLocaleString()}</span>
                            </td>
                            <td className="py-2 px-2">
                              <div className={cn(
                                "flex items-center justify-center gap-2 py-1.5 rounded-md",
                                item.qtyEfectivo > 0 ? "bg-success/10 border border-success/20" : "bg-muted/30"
                              )}>
                                <button
                                  onClick={() => updateGridQty(idx, 'efectivo', -1)}
                                  disabled={item.qtyEfectivo === 0}
                                  className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.qtyEfectivo}</span>
                                <button
                                  onClick={() => updateGridQty(idx, 'efectivo', 1)}
                                  className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div className={cn(
                                "flex items-center justify-center gap-2 py-1.5 rounded-md",
                                item.qtyDigital > 0 ? "bg-status-info-bg border border-status-info/20" : "bg-muted/30"
                              )}>
                                <button
                                  onClick={() => updateGridQty(idx, 'digital', -1)}
                                  disabled={item.qtyDigital === 0}
                                  className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.qtyDigital}</span>
                                <button
                                  onClick={() => updateGridQty(idx, 'digital', 1)}
                                  className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-border">
                        <tr>
                          <td className="py-3 text-sm font-semibold text-muted-foreground">Total por método</td>
                          <td className="text-center font-bold text-success py-3">${totals.efectivo.toLocaleString()}</td>
                          <td className="text-center font-bold text-status-info-foreground py-3">${totals.mp.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile: cards */}
                  <div className="block sm:hidden space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                        <div>
                          <span className="text-sm font-medium">{item.servicioNombre}</span>
                          <span className="text-xs text-muted-foreground block">${item.unitPrice.toLocaleString()}</span>
                        </div>
                        <div className={cn(
                          "flex items-center justify-between p-2 rounded-md",
                          item.qtyEfectivo > 0 ? "bg-success/10 border border-success/20" : "bg-muted/30 border border-border"
                        )}>
                          <span className="text-xs font-medium text-success flex items-center gap-1">
                            <Banknote className="h-3 w-3" /> Efectivo
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateGridQty(idx, 'efectivo', -1)}
                              disabled={item.qtyEfectivo === 0}
                              className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.qtyEfectivo}</span>
                            <button
                              onClick={() => updateGridQty(idx, 'efectivo', 1)}
                              className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className={cn(
                          "flex items-center justify-between p-2 rounded-md",
                          item.qtyDigital > 0 ? "bg-status-info-bg border border-status-info/20" : "bg-muted/30 border border-border"
                        )}>
                          <span className="text-xs font-medium text-status-info-foreground flex items-center gap-1">
                            <CreditCard className="h-3 w-3" /> Digital
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateGridQty(idx, 'digital', -1)}
                              disabled={item.qtyDigital === 0}
                              className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.qtyDigital}</span>
                            <button
                              onClick={() => updateGridQty(idx, 'digital', 1)}
                              className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Step 3 — Resumen */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Resumen del cierre diferido</h3>

              <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Barbero</span>
                  <span className="font-medium text-sm">{selectedBarber?.firstName} {selectedBarber?.lastName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Motivo</span>
                  <span className="text-sm text-right max-w-[60%]">{reason}</span>
                </div>
                {note && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Nota</span>
                    <span className="text-sm text-right max-w-[60%]">{note}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Banknote className="h-3.5 w-3.5 text-success" /> Efectivo
                  </p>
                  <p className="text-xl font-bold text-success">${totals.efectivo.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg bg-status-info-bg border border-status-info/20">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                    <CreditCard className="h-3.5 w-3.5 text-status-info-foreground" /> Digital
                  </p>
                  <p className="text-xl font-bold text-status-info-foreground">${totals.mp.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-primary text-primary-foreground">
                <span className="font-semibold">Total del día</span>
                <span className="text-xl font-bold">${totals.total.toLocaleString()}</span>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Comisión ({selectedBarber?.commission}%)</span>
                  <span className="font-medium">${totals.commission.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Servicios</span>
                  <span className="font-medium">{totals.services}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Modo de carga</span>
                  <Badge variant="outline">{loadMode === 'quick' ? 'Carga rápida' : 'Por servicio'}</Badge>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Confirmar */}
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
        <div className="shrink-0 px-6 py-4 border-t flex items-center gap-2">
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
            <Button
              onClick={handleConfirm}
              disabled={isSaving}
              className="bg-success hover:bg-success/90 text-white"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {isSaving ? 'Guardando...' : 'Confirmar cierre diferido'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
