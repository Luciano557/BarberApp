import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Barber, Service, Line, PaymentMethod, PAYMENT_METHODS } from '@/types/barbershop';
import { useBackfillClosing, BackfillServiceItem } from '@/hooks/useBackfillClosing';
import { usePaymentMethodsConfig } from '@/hooks/usePaymentMethodsConfig';
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
  qty: Record<PaymentMethod, number>;
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

const emptyQty = (): Record<PaymentMethod, number> =>
  Object.fromEntries(PAYMENT_METHODS.map(m => [m, 0])) as Record<PaymentMethod, number>;

/**
 * Un schema único para los 3 pasos con validación real (Barbero/Motivo/Servicios);
 * Resumen y Confirmar no tienen campos propios. `hasServiceData` espeja
 * `totals.totalCobrado > 0 || totals.services > 0` (deriva de items/quickAmounts,
 * que viven fuera del form). El gate de "no avanzar si el paso es inválido" se
 * resuelve leyendo `schema.shape.<campo>.safeParse(...)` directo — necesita ser
 * síncrono en cada render para deshabilitar el botón "Siguiente" en vivo, sin
 * esperar al ciclo async de validación de RHF.
 */
const backfillSchema = z.object({
  barberId: z.string().min(1, 'Seleccioná un barbero'),
  reason: z.string().min(1, 'Seleccioná un motivo'),
  note: z.string().max(240).optional().default(''),
  hasServiceData: z.boolean().refine((v) => v === true, { message: 'Cargá al menos un servicio o un monto.' }),
});

type BackfillFormValues = z.infer<typeof backfillSchema>;

export function BackfillWizard({ open, onOpenChange, date, barbers, services, lines: _lines, closedBarberIds, onComplete }: BackfillWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [loadMode, setLoadMode] = useState<'detailed' | 'quick'>('quick');
  const [items, setItems] = useState<GridItem[]>([]);
  const [quickAmounts, setQuickAmounts] = useState<Record<PaymentMethod, number>>(emptyQty());
  const [quickCantidad, setQuickCantidad] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const { saveBackfill } = useBackfillClosing();
  const { methods, loading: methodsLoading, getRecargoPct } = usePaymentMethodsConfig();
  const activeMethods = useMemo(() => methods.filter(m => m.activo), [methods]);

  const form = useForm<BackfillFormValues>({
    resolver: zodResolver(backfillSchema),
    defaultValues: { barberId: '', reason: '', note: '', hasServiceData: false },
  });

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
        qty: emptyQty(),
      })));
    }
  };

  const totals = useMemo(() => {
    if (loadMode === 'quick') {
      let efectivoBase = 0, digitalBase = 0;
      let efectivoCobrado = 0, digitalCobrado = 0;
      let recargosTotal = 0;
      Object.entries(quickAmounts).forEach(([method, cobrado]) => {
        if (!cobrado) return;
        const recargoPct = getRecargoPct(method as PaymentMethod);
        const base = recargoPct > 0
          ? Math.round(cobrado * 100 / (100 + recargoPct))
          : cobrado;
        const recargoMonto = cobrado - base;
        recargosTotal += recargoMonto;
        if (method === 'efectivo') {
          efectivoBase += base;
          efectivoCobrado += cobrado;
        } else {
          digitalBase += base;
          digitalCobrado += cobrado;
        }
      });
      const totalBase = efectivoBase + digitalBase;
      const totalCobrado = efectivoCobrado + digitalCobrado;
      const commission = selectedBarber
        ? Math.round(totalBase * (selectedBarber.commission / 100))
        : 0;
      return { efectivoBase, digitalBase, totalBase, efectivoCobrado, digitalCobrado, totalCobrado, recargosTotal, services: quickCantidad, commission };
    }
    let efectivoBase = 0, digitalBase = 0;
    let efectivoCobrado = 0, digitalCobrado = 0;
    let recargosTotal = 0;
    let serviceCount = 0;
    items.forEach(item => {
      PAYMENT_METHODS.forEach(method => {
        const qty = item.qty[method] || 0;
        if (qty === 0) return;
        const base = qty * item.unitPrice;
        const recargoPct = getRecargoPct(method);
        const recargoMonto = Math.round(base * recargoPct / 100);
        recargosTotal += recargoMonto;
        serviceCount += qty;
        if (method === 'efectivo') {
          efectivoBase += base;
          efectivoCobrado += base + recargoMonto;
        } else {
          digitalBase += base;
          digitalCobrado += base + recargoMonto;
        }
      });
    });
    const totalBase = efectivoBase + digitalBase;
    const totalCobrado = efectivoCobrado + digitalCobrado;
    const commission = selectedBarber
      ? Math.round(totalBase * (selectedBarber.commission / 100))
      : 0;
    return { efectivoBase, digitalBase, totalBase, efectivoCobrado, digitalCobrado, totalCobrado, recargosTotal, services: serviceCount, commission };
  }, [loadMode, quickAmounts, quickCantidad, items, selectedBarber, getRecargoPct]);

  useEffect(() => {
    form.setValue('hasServiceData', totals.totalCobrado > 0 || totals.services > 0);
  }, [totals, form]);

  const canAdvance = () => {
    switch (step) {
      case 0: return backfillSchema.shape.barberId.safeParse(selectedBarberId).success;
      case 1: return backfillSchema.shape.reason.safeParse(reason).success;
      case 2: return backfillSchema.shape.hasServiceData.safeParse(totals.totalCobrado > 0 || totals.services > 0).success;
      case 3: return true;
      default: return false;
    }
  };

  const toBackfillItems = (grid: GridItem[]): BackfillServiceItem[] =>
    grid.flatMap(item =>
      PAYMENT_METHODS
        .filter(m => (item.qty[m] || 0) > 0)
        .map(m => ({
          servicioId: item.servicioId,
          servicioNombre: item.servicioNombre,
          lineaId: item.lineaId,
          qty: item.qty[m],
          unitPrice: item.unitPrice,
          paymentMethod: m,
        }))
    );

  const updateGridQty = (idx: number, method: PaymentMethod, delta: number) => {
    setItems(prev => prev.map((item, i) =>
      i === idx
        ? { ...item, qty: { ...item.qty, [method]: Math.max(0, (item.qty[method] || 0) + delta) } }
        : item
    ));
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
    const isValid = await form.trigger();
    if (!isValid) return;
    setIsSaving(true);
    const success = await saveBackfill({
      barberId: selectedBarberId,
      barberName: `${selectedBarber.firstName} ${selectedBarber.lastName}`.trim(),
      commissionPct: selectedBarber.commission,
      date,
      reason,
      note,
      mode: loadMode,
      items: loadMode === 'detailed' ? toBackfillItems(items) : [],
      quickData: loadMode === 'quick'
        ? { amounts: quickAmounts, cantidadServicios: quickCantidad }
        : null,
      methodSurcharges: Object.fromEntries(
        methods.map(m => [m.method, m.recargoPct])
      ) as Record<PaymentMethod, number>,
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
    setQuickAmounts(emptyQty());
    setQuickCantidad(0);
    form.reset({ barberId: '', reason: '', note: '', hasServiceData: false });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <SheetContent
        side="right"
        className={cn(
          "flex flex-col p-0 gap-0",
          step === 2 && loadMode === 'detailed'
            ? activeMethods.length > 2
              ? "sm:max-w-4xl"
              : "sm:max-w-3xl"
            : "sm:max-w-2xl"
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
                      onClick={() => { setSelectedBarberId(b.id); form.setValue('barberId', b.id); }}
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
                  Motivo del cierre diferido
                </Label>
                <div className="grid gap-2">
                  {BACKFILL_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => { setReason(r); form.setValue('reason', r); }}
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
                  onChange={(e) => { setNote(e.target.value); form.setValue('note', e.target.value); }}
                  placeholder="Detalle adicional sobre el cierre..."
                  maxLength={240}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 2 — Servicios */}
          {step === 2 && (
            <div className="space-y-4">
              {methodsLoading && activeMethods.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
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
                      {activeMethods.map(m => (
                        <div key={m.method} className="space-y-2">
                          <Label className="text-sm flex items-center gap-1.5">
                            {m.method === 'efectivo'
                              ? <Banknote className="h-4 w-4 text-success" />
                              : <CreditCard className="h-4 w-4 text-status-info-foreground" />
                            }
                            {m.label}
                            {m.recargoPct > 0 && (
                              <span className="text-xs text-muted-foreground">(+{m.recargoPct}%)</span>
                            )}
                          </Label>
                          <CurrencyInput
                            value={quickAmounts[m.method] ? String(quickAmounts[m.method]) : ''}
                            onChange={(v) => setQuickAmounts(prev => ({ ...prev, [m.method]: Number(v) || 0 }))}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Cantidad de servicios</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={quickCantidad || ''}
                        onChange={(e) => setQuickCantidad(Number(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    {totals.totalCobrado > 0 && (
                      <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total cobrado</span>
                          <span className="font-semibold">${totals.totalCobrado.toLocaleString()}</span>
                        </div>
                        {totals.recargosTotal > 0 && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Incluye recargos</span>
                            <span>+${totals.recargosTotal.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="detailed" className="mt-4">
                    <p className="text-xs text-muted-foreground mb-3">Indicá cantidad por método de pago para cada servicio realizado.</p>

                    {/* Desktop: tabla dinámica */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full min-w-[480px]">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4 w-[40%]">Servicio</th>
                            {activeMethods.map(m => (
                              <th key={m.method} className="text-center text-xs font-medium py-2">
                                <span className={cn(
                                  "flex items-center justify-center gap-1",
                                  m.method === 'efectivo' ? "text-success" : "text-status-info-foreground"
                                )}>
                                  {m.method === 'efectivo'
                                    ? <Banknote className="h-3.5 w-3.5" />
                                    : <CreditCard className="h-3.5 w-3.5" />
                                  }
                                  {m.label}
                                  {m.recargoPct > 0 && (
                                    <span className="text-muted-foreground text-[10px]">+{m.recargoPct}%</span>
                                  )}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr key={idx} className="border-b border-border/40">
                              <td className="py-3 pr-4">
                                <span className="text-sm font-medium">{item.servicioNombre}</span>
                                <span className="text-xs text-muted-foreground block">${item.unitPrice.toLocaleString()}</span>
                              </td>
                              {activeMethods.map(m => {
                                const qty = item.qty[m.method] || 0;
                                const isEfectivo = m.method === 'efectivo';
                                return (
                                  <td key={m.method} className="py-2 px-2">
                                    <div className={cn(
                                      "flex items-center justify-center gap-2 py-1.5 rounded-md",
                                      qty > 0
                                        ? isEfectivo
                                          ? "bg-success/10 border border-success/20"
                                          : "bg-status-info-bg border border-status-info/20"
                                        : "bg-muted/30"
                                    )}>
                                      <button
                                        onClick={() => updateGridQty(idx, m.method, -1)}
                                        disabled={qty === 0}
                                        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <span className="w-5 text-center text-sm font-semibold tabular-nums">{qty}</span>
                                      <button
                                        onClick={() => updateGridQty(idx, m.method, 1)}
                                        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-border">
                          <tr>
                            <td className="py-3 text-sm font-semibold text-muted-foreground">Total por método</td>
                            {activeMethods.map(m => {
                              const isEfectivo = m.method === 'efectivo';
                              const base = items.reduce((acc, item) => acc + (item.qty[m.method] || 0) * item.unitPrice, 0);
                              const cobrado = base + Math.round(base * getRecargoPct(m.method) / 100);
                              return (
                                <td key={m.method} className={cn(
                                  "text-center font-bold py-3 text-sm",
                                  isEfectivo ? "text-success" : "text-status-info-foreground"
                                )}>
                                  ${cobrado.toLocaleString()}
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Mobile: cards apiladas */}
                    <div className="block sm:hidden space-y-3">
                      {items.map((item, idx) => (
                        <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                          <div>
                            <span className="text-sm font-medium">{item.servicioNombre}</span>
                            <span className="text-xs text-muted-foreground block">${item.unitPrice.toLocaleString()}</span>
                          </div>
                          {activeMethods.map(m => {
                            const qty = item.qty[m.method] || 0;
                            const isEfectivo = m.method === 'efectivo';
                            return (
                              <div key={m.method} className={cn(
                                "flex items-center justify-between p-2 rounded-md",
                                qty > 0
                                  ? isEfectivo
                                    ? "bg-success/10 border border-success/20"
                                    : "bg-status-info-bg border border-status-info/20"
                                  : "bg-muted/30 border border-border"
                              )}>
                                <span className={cn(
                                  "text-xs font-medium flex items-center gap-1",
                                  isEfectivo ? "text-success" : "text-status-info-foreground"
                                )}>
                                  {isEfectivo
                                    ? <Banknote className="h-3 w-3" />
                                    : <CreditCard className="h-3 w-3" />
                                  }
                                  {m.label}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateGridQty(idx, m.method, -1)}
                                    disabled={qty === 0}
                                    className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-5 text-center text-sm font-semibold tabular-nums">{qty}</span>
                                  <button
                                    onClick={() => updateGridQty(idx, m.method, 1)}
                                    className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
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
                  <p className="text-xl font-bold text-success">${totals.efectivoCobrado.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg bg-status-info-bg border border-status-info/20">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                    <CreditCard className="h-3.5 w-3.5 text-status-info-foreground" /> Digital
                  </p>
                  <p className="text-xl font-bold text-status-info-foreground">${totals.digitalCobrado.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-primary text-primary-foreground">
                <span className="font-semibold">Total del día</span>
                <span className="text-xl font-bold">${totals.totalCobrado.toLocaleString()}</span>
              </div>

              <div className="space-y-2 pt-1">
                {totals.recargosTotal > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Recargos incluidos</span>
                    <span className="text-muted-foreground">+${totals.recargosTotal.toLocaleString()}</span>
                  </div>
                )}
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
