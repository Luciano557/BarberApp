import { useState, useMemo, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { CreditCard, Banknote, Check, Percent, ArrowLeft, ArrowRight, User, Sparkles, Wallet, Tag, Scissors, DollarSign, ClipboardList, X, Split, Package, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Service, Extra, Barber, Discount, PaymentMethod, DiscountType, Line, getMethodLabel } from '@/types/barbershop';
import { useTareas } from '@/hooks/useTareas';
import { DailyTurnosViewer } from '@/components/DailyTurnosViewer';
import { CurrencyInput } from '@/components/ui/currency-input';
import { usePaymentMethodsConfig } from '@/hooks/usePaymentMethodsConfig';
import { useAuth } from '@/contexts/AuthContext';
import { ProductoPickerDialog, CartItem } from '@/components/productos/ProductoPickerDialog';
import { ProductoCartInput } from '@/hooks/useTransactions';
import { Badge } from '@/components/ui/badge';

const isPriceMissing = (p: number | null | undefined) => !p || p <= 0;

interface PaymentRegistrationProps {
  services: Service[];
  extras: Extra[];
  barbers: Barber[];
  discounts: Discount[];
  lines?: Line[];
  sucursalId?: string | null;
  onNavigateToTareas?: () => void;
  onSubmit: (data: {
    barberId: string;
    barberName: string;
    serviceId: string;
    serviceName: string;
    servicePrice: number;
    extras: { uid: string; name: string; price: number }[];
    discount: number;
    discountType: DiscountType;
    paymentMethod: PaymentMethod;
    payments?: { method: PaymentMethod; amount: number; basePago: number; recargoPct: number; recargoMonto: number }[];
    subtotal: number;
    total: number;
    productos?: ProductoCartInput[];
  }) => Promise<any | null>;
}

type Step = 'barber' | 'service' | 'extras' | 'discount' | 'payment';

const STEPS: Step[] = ['barber', 'service', 'extras', 'discount', 'payment'];

const STEP_INFO = {
  barber: { title: 'Barbero', subtitle: 'Elegí quién atendió o sumá productos', icon: User },
  service: { title: 'Servicio', subtitle: 'Selecciona el servicio principal', icon: Scissors },
  extras: { title: 'Extras', subtitle: 'Agrega extras opcionales', icon: Sparkles },
  discount: { title: 'Descuento', subtitle: 'Aplica un descuento si corresponde (solo servicios)', icon: Tag },
  payment: { title: 'Método de Pago', subtitle: 'Selecciona cómo paga el cliente', icon: Wallet },
};

export function PaymentRegistration({ services, extras, barbers, discounts, lines = [], sucursalId, onSubmit, onNavigateToTareas }: PaymentRegistrationProps) {
  const { toast } = useToast();
  const { tareas } = useTareas();
  const { isOwner, isGeneralManager, isManager } = useAuth();
  const canEditProductPrice = isOwner || isGeneralManager || isManager;
  const [currentStep, setCurrentStep] = useState<Step>('barber');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedDiscount, setSelectedDiscount] = useState('none');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [splitMode, setSplitMode] = useState(false);
  const [efectivoAmount, setEfectivoAmount] = useState<string>('');
  const [mpAmount, setMpAmount] = useState<string>('');
  const [selectedDigitalMethod, setSelectedDigitalMethod] = useState<PaymentMethod | ''>('');
  const [showTasksBubble, setShowTasksBubble] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Productos
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cartBarberId, setCartBarberId] = useState<string | null>(null);
  const [cartBarberName, setCartBarberName] = useState<string | null>(null);
  // Asignación explícita de la venta de productos: pending | no_barber | barber
  type ProductSaleAssignment = 'pending' | 'no_barber' | 'barber';
  const [productSaleAssignment, setProductSaleAssignment] = useState<ProductSaleAssignment>('pending');
  // Cancelar venta
  const [cancelOpen, setCancelOpen] = useState(false);

  const { methods, getRecargoPct, loading: methodsLoading } = usePaymentMethodsConfig();
  const activeMethods = useMemo(() => methods.filter(m => m.activo), [methods]);
  const electronicMethods = useMemo(
    () => activeMethods.filter(m => m.method !== 'efectivo'),
    [activeMethods],
  );
  const isEfectivoActive = useMemo(
    () => activeMethods.some(m => m.method === 'efectivo'),
    [activeMethods],
  );

  const pendingTasks = useMemo(() => 
    tareas.filter(t => t.estado === 'pendiente' && t.tipo === 'tarea'),
    [tareas]
  );

  const currentStepIndex = STEPS.indexOf(currentStep);
  const service = useMemo(() => services.find(s => s.id === selectedService), [services, selectedService]);
  const barber = useMemo(() => barbers.find(b => b.uid === selectedBarber), [barbers, selectedBarber]);
  const selectedExtrasData = useMemo(() =>
    extras.filter(e => selectedExtras.includes(e.id)),
    [extras, selectedExtras]
  );

  // Subtotal de servicios (servicio + extras). NO incluye productos.
  const subtotalServicios = useMemo(() => {
    const servicePrice = service?.price || 0;
    const extrasTotal = selectedExtrasData.reduce((sum, e) => sum + e.price, 0);
    return servicePrice + extrasTotal;
  }, [service, selectedExtrasData]);

  // Subtotal de productos (precio_unitario * cantidad). No se le aplican descuentos.
  const subtotalProductos = useMemo(
    () => cart.reduce((sum, it) => sum + it.precio_unitario * it.cantidad, 0),
    [cart]
  );

  // Subtotal total (servicios + productos)
  const subtotal = subtotalServicios + subtotalProductos;

  const selectedDiscountData = useMemo(() => {
    return discounts.find(d => d.id === selectedDiscount);
  }, [discounts, selectedDiscount]);

  // Check if selected discount is valid for the payment method
  const isDiscountValidForPayment = useMemo(() => {
    if (!selectedDiscountData || !paymentMethod) return true;
    if (selectedDiscountData.paymentMethod === 'todos') return true;
    return selectedDiscountData.paymentMethod === paymentMethod;
  }, [selectedDiscountData, paymentMethod]);

  // Descuento se aplica SOLO sobre el subtotal de servicios
  const discountAmount = useMemo(() => {
    if (!selectedDiscountData || selectedDiscountData.value === 0) return 0;
    if (!isDiscountValidForPayment) return 0;
    if (subtotalServicios === 0) return 0;

    if (selectedDiscountData.type === 'fixed') {
      return Math.min(selectedDiscountData.value, subtotalServicios);
    }
    const rawDiscount = subtotalServicios * (selectedDiscountData.value / 100);
    const rounding = selectedDiscountData.rounding || 'cliente';
    const unit = selectedDiscountData.roundingUnit || 1;

    let roundedDiscount: number;
    if (unit === 1) {
      switch (rounding) {
        case 'negocio': roundedDiscount = Math.ceil(rawDiscount); break;
        case 'matematico': roundedDiscount = Math.round(rawDiscount); break;
        default: roundedDiscount = Math.floor(rawDiscount); break;
      }
    } else {
      switch (rounding) {
        case 'negocio': roundedDiscount = Math.ceil(rawDiscount / unit) * unit; break;
        case 'matematico': roundedDiscount = Math.round(rawDiscount / unit) * unit; break;
        default: roundedDiscount = Math.floor(rawDiscount / unit) * unit; break;
      }
    }
    return roundedDiscount;
  }, [subtotalServicios, selectedDiscountData, isDiscountValidForPayment]);

  const total = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);

  const goToNextStep = useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1]);
    }
  }, [currentStepIndex]);

  const goToPrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1]);
    }
  }, [currentStepIndex]);

  const handleSelectBarber = useCallback((barberId: string) => {
    const b = barbers.find(x => x.uid === barberId);
    const fullName = b ? `${b.firstName} ${b.lastName}` : '';

    if (cart.length > 0) {
      // Carrito asignado a otro barbero: bloquear.
      if (productSaleAssignment === 'barber' && cartBarberId && cartBarberId !== barberId) {
        toast({
          title: 'Productos asignados a otro barbero',
          description: `Los productos están asignados a ${cartBarberName ?? 'otro barbero'}. Cambiá la asignación tocando ese barbero u otra opción, o cancelá la venta para empezar de nuevo.`,
          variant: 'destructive',
        });
        return;
      }
      // pending | no_barber | mismo barber → asignar/reasignar al barbero tocado.
      setProductSaleAssignment('barber');
      setCartBarberId(barberId);
      setCartBarberName(fullName);
    }

    setSelectedBarber(barberId);
    setTimeout(() => goToNextStep(), 100);
  }, [barbers, cart.length, cartBarberId, cartBarberName, productSaleAssignment, goToNextStep, toast]);

  const handleSelectNoBarber = useCallback(() => {
    setProductSaleAssignment('no_barber');
    setCartBarberId(null);
    setCartBarberName(null);
    setSelectedBarber('');
    setSelectedService('');
    setSelectedExtras([]);
    setSelectedDiscount('none');
    // Helper: hoy va directo a payment. Encapsulado para que en el futuro pueda enrutar a un step de descuento de productos.
    setCurrentStep('payment');
  }, []);

  const handleSelectService = useCallback((serviceId: string) => {
    if (!selectedBarber) {
      toast({
        title: 'Falta barbero',
        description: 'Para agregar un servicio, primero seleccioná un barbero.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedService(serviceId);
    setTimeout(() => goToNextStep(), 100);
  }, [selectedBarber, goToNextStep, toast]);


  const handleToggleExtra = useCallback((extraId: string) => {
    setSelectedExtras(prev =>
      prev.includes(extraId)
        ? prev.filter(id => id !== extraId)
        : [...prev, extraId]
    );
  }, []);

  const handleSelectDiscount = useCallback((discountId: string) => {
    setSelectedDiscount(discountId);
    setTimeout(() => goToNextStep(), 100);
  }, [goToNextStep]);

  const handleSelectPayment = useCallback((method: PaymentMethod) => {
    setSplitMode(false);
    setEfectivoAmount('');
    setMpAmount('');
    setPaymentMethod(method);
  }, []);

  const enableSplitMode = useCallback(() => {
    setSplitMode(true);
    setPaymentMethod('efectivo');
    setEfectivoAmount('');
    setMpAmount('');
  }, []);

  const cancelSplitMode = useCallback(() => {
    setSplitMode(false);
    setEfectivoAmount('');
    setMpAmount('');
    setPaymentMethod('');
  }, []);

  const handleEfectivoChange = useCallback((val: string) => {
    setEfectivoAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && total > 0) {
      const remainder = Math.max(0, total - num);
      setMpAmount(remainder > 0 ? remainder.toString() : '');
    } else if (val === '') {
      setMpAmount('');
    }
  }, [total]);

  const handleMpChange = useCallback((val: string) => {
    setMpAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && total > 0) {
      const remainder = Math.max(0, total - num);
      setEfectivoAmount(remainder > 0 ? remainder.toString() : '');
    } else if (val === '') {
      setEfectivoAmount('');
    }
  }, [total]);

  const splitEfectivoNum = parseFloat(efectivoAmount) || 0;
  const splitMpNum = parseFloat(mpAmount) || 0;
  const splitSum = splitEfectivoNum + splitMpNum;
  const splitValid = splitMode
    && splitEfectivoNum > 0
    && splitMpNum > 0
    && Math.abs(splitSum - total) < 0.01
    && splitEfectivoNum <= total
    && splitMpNum <= total;

  // Recargos
  const pctSimple = paymentMethod ? getRecargoPct(paymentMethod) : 0;
  const pctEfectivo = getRecargoPct('efectivo');
  const pctDigital = selectedDigitalMethod ? getRecargoPct(selectedDigitalMethod) : 0;

  const recargoTotal = useMemo(() => {
    if (splitMode) {
      return Math.round((splitEfectivoNum * pctEfectivo) / 100)
        + Math.round((splitMpNum * pctDigital) / 100);
    }
    if (!paymentMethod) return 0;
    return Math.round((total * pctSimple) / 100);
  }, [splitMode, splitEfectivoNum, splitMpNum, pctEfectivo, pctDigital, total, pctSimple, paymentMethod]);

  const totalACobrar = total + recargoTotal;

  const recargoLabel = useMemo(() => {
    if (recargoTotal <= 0) return '';
    if (splitMode) {
      const partsActive = [pctEfectivo > 0, pctDigital > 0].filter(Boolean).length;
      if (partsActive > 1) return 'Recargo (mixto)';
      if (pctEfectivo > 0) return `Recargo (Efectivo ${pctEfectivo}%)`;
      if (pctDigital > 0 && selectedDigitalMethod) return `Recargo (${getMethodLabel(selectedDigitalMethod)} ${pctDigital}%)`;
      return 'Recargo';
    }
    if (paymentMethod) return `Recargo (${getMethodLabel(paymentMethod)} ${pctSimple}%)`;
    return 'Recargo';
  }, [recargoTotal, splitMode, pctEfectivo, pctDigital, selectedDigitalMethod, paymentMethod, pctSimple]);

  // Inicializar / sincronizar selectedDigitalMethod con la lista activa
  useEffect(() => {
    if (electronicMethods.length === 0) {
      if (selectedDigitalMethod !== '') setSelectedDigitalMethod('');
      return;
    }
    const stillActive = selectedDigitalMethod
      && electronicMethods.some(m => m.method === selectedDigitalMethod);
    if (!stillActive) {
      const mp = electronicMethods.find(m => m.method === 'mercado_pago');
      setSelectedDigitalMethod(mp ? mp.method : electronicMethods[0].method);
    }
  }, [electronicMethods, selectedDigitalMethod]);

  // Self-healing: si el método elegido se desactivó en otra pestaña
  useEffect(() => {
    if (methodsLoading) return;
    const activeSet = new Set(activeMethods.map(m => m.method));
    if (!splitMode && paymentMethod && !activeSet.has(paymentMethod)) {
      setPaymentMethod('');
    }
    if (splitMode && !activeSet.has('efectivo')) {
      setSplitMode(false);
      setEfectivoAmount('');
      setMpAmount('');
      setPaymentMethod('');
    }
  }, [methodsLoading, activeMethods, paymentMethod, splitMode]);

  const resetForm = useCallback(() => {
    setSelectedBarber('');
    setSelectedService('');
    setSelectedExtras([]);
    setSelectedDiscount('none');
    setPaymentMethod('');
    setSplitMode(false);
    setEfectivoAmount('');
    setMpAmount('');
    setCart([]);
    setCartBarberId(null);
    setCartBarberName(null);
    setProductSaleAssignment('pending');
    setCurrentStep('barber');
  }, []);

  const handleSubmit = useCallback(async () => {
    const hasService = !!selectedService;
    const hasProducts = cart.length > 0;

    if (!hasService && !hasProducts) {
      toast({
        title: 'Venta vacía',
        description: 'Agregá al menos un servicio o un producto.',
        variant: 'destructive',
      });
      return;
    }
    if (hasService && !selectedBarber) {
      toast({
        title: 'Falta barbero',
        description: 'Seleccioná el barbero que atendió el servicio.',
        variant: 'destructive',
      });
      return;
    }
    if (!paymentMethod) {
      toast({
        title: 'Falta método de pago',
        description: 'Seleccioná cómo paga el cliente.',
        variant: 'destructive',
      });
      return;
    }

    if (splitMode && !splitValid) {
      toast({
        title: "Pagos inválidos",
        description: "La suma debe ser igual al total y ambos métodos mayores a cero.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let payments: { method: PaymentMethod; amount: number; basePago: number; recargoPct: number; recargoMonto: number }[];
      let primaryMethod: PaymentMethod;

      if (splitMode) {
        if (!selectedDigitalMethod) {
          toast({
            title: 'Falta método electrónico',
            description: 'Seleccioná el método electrónico para el split.',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
        const recE = Math.round((splitEfectivoNum * pctEfectivo) / 100);
        const recD = Math.round((splitMpNum * pctDigital) / 100);
        payments = [
          { method: 'efectivo', basePago: splitEfectivoNum, recargoPct: pctEfectivo, recargoMonto: recE, amount: splitEfectivoNum + recE },
          { method: selectedDigitalMethod, basePago: splitMpNum, recargoPct: pctDigital, recargoMonto: recD, amount: splitMpNum + recD },
        ];
        primaryMethod = splitEfectivoNum >= splitMpNum ? 'efectivo' : selectedDigitalMethod;
      } else {
        const recargoMonto = Math.round((total * pctSimple) / 100);
        payments = [{ method: paymentMethod, basePago: total, recargoPct: pctSimple, recargoMonto, amount: total + recargoMonto }];
        primaryMethod = paymentMethod;
      }

      const productosPayload: ProductoCartInput[] = cart.map(it => ({
        producto_id: it.producto_id,
        producto_sucursal_id: it.producto_sucursal_id,
        producto_nombre: it.nombre,
        marca_id: it.marca_id,
        marca_nombre: it.marca_nombre,
        precio_unitario: it.precio_unitario,
        cantidad: it.cantidad,
      }));

      // Si hay servicio: barbero del servicio. Si solo productos: depende de la asignación.
      const finalBarberId = hasService
        ? (barber?.id || '')
        : (productSaleAssignment === 'barber' ? (cartBarberId || '') : '');
      const finalBarberName = hasService
        ? (barber ? `${barber.firstName} ${barber.lastName}` : '')
        : (productSaleAssignment === 'barber' ? (cartBarberName || '') : '');

      const result = await onSubmit({
        barberId: finalBarberId,
        barberName: finalBarberName,
        serviceId: service?.id || '',
        serviceName: service?.name || '',
        servicePrice: service?.price || 0,
        extras: selectedExtrasData.map(e => ({ uid: e.id, name: e.name, price: e.price })),
        discount: selectedDiscountData?.value || 0,
        discountType: selectedDiscountData?.type || 'percentage',
        paymentMethod: primaryMethod,
        payments,
        subtotal,
        total,
        productos: productosPayload,
      });

      if (result) {
        const summaryLabel = hasService ? service!.name : `${cart.length} producto${cart.length > 1 ? 's' : ''}`;
        toast({
          title: "✅ Cobro guardado correctamente",
          description: recargoTotal > 0
            ? `$${totalACobrar.toLocaleString()} (incluye recargo $${recargoTotal.toLocaleString()}) - ${summaryLabel}`
            : `$${total.toLocaleString()} - ${summaryLabel}`,
        });
        resetForm();
      } else {
        toast({
          title: "❌ No se pudo guardar el cobro",
          description: "Revisá tu conexión a Internet e intentá de nuevo.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Error inesperado",
        description: "Ocurrió un problema al guardar. Intentá de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedBarber, selectedService, paymentMethod, barber, service, selectedExtrasData, selectedDiscountData, subtotal, total, onSubmit, toast, resetForm, splitMode, splitValid, splitEfectivoNum, splitMpNum, selectedDigitalMethod, pctEfectivo, pctDigital, pctSimple, recargoTotal, totalACobrar, cart, cartBarberId, cartBarberName, productSaleAssignment]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;

        if (currentStep === 'barber' && barbers[index]) {
          handleSelectBarber(barbers[index].uid);
        } else if (currentStep === 'barber' && cart.length > 0 && index === barbers.length) {
          handleSelectNoBarber();
        } else if (currentStep === 'service' && services[index]) {
          handleSelectService(services[index].id);
        } else if (currentStep === 'extras' && extras[index]) {
          handleToggleExtra(extras[index].id);
        } else if (currentStep === 'discount' && discounts[index]) {
          handleSelectDiscount(discounts[index].id);
        } else if (currentStep === 'payment' && activeMethods[index]) {
          handleSelectPayment(activeMethods[index].method);
        }
      }

      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (currentStep === 'extras') {
          e.preventDefault();
          goToNextStep();
        } else if (currentStep === 'payment' && paymentMethod) {
          e.preventDefault();
          handleSubmit();
        }
      }

      if (e.key === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        goToPrevStep();
      }
      if (e.key === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        if (currentStep === 'barber' && selectedBarber) goToNextStep();
        if (currentStep === 'service' && selectedService) goToNextStep();
        if (currentStep === 'extras') goToNextStep();
      }

      if (e.key === 'Escape') {
        goToPrevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, barbers, services, extras, discounts, paymentMethod, selectedBarber, selectedService, activeMethods, handleSelectBarber, handleSelectNoBarber, handleSelectService, handleToggleExtra, handleSelectDiscount, handleSelectPayment, goToNextStep, goToPrevStep, handleSubmit, cart.length]);

  const StepIcon = STEP_INFO[currentStep].icon;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Nuevo Cobro</h1>
        <p className="text-muted-foreground text-sm mt-1">Ctrl+1-9 para selección rápida</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, index) => (
          <div key={step} className="flex items-center flex-1">
            <button
              onClick={() => {
                if (index <= currentStepIndex) {
                  setCurrentStep(step);
                }
              }}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                index < currentStepIndex
                  ? 'bg-secondary cursor-pointer'
                  : index === currentStepIndex
                  ? 'bg-foreground'
                  : 'bg-border'
              }`}
            />
            {index < STEPS.length - 1 && <div className="w-1" />}
          </div>
        ))}
      </div>

      {/* Step Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-border">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
          <StepIcon className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-medium text-foreground">{STEP_INFO[currentStep].title}</h2>
          <p className="text-sm text-muted-foreground">{STEP_INFO[currentStep].subtitle}</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {currentStepIndex + 1}/{STEPS.length}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[320px]">
        {/* Barber Step */}
        {currentStep === 'barber' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {barbers.map((barber, index) => {
                const isSelected =
                  selectedBarber === barber.uid ||
                  (productSaleAssignment === 'barber' && cartBarberId === barber.uid);
                return (
                  <button
                    key={barber.uid}
                    onClick={() => handleSelectBarber(barber.uid)}
                    className={`relative p-6 rounded-lg border transition-colors hover:border-secondary ${
                      isSelected
                        ? 'border-secondary bg-secondary/5'
                        : 'border-border bg-card hover:bg-muted/50'
                    }`}
                  >
                    <span className="absolute top-3 left-3 text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-center text-foreground">{`${barber.firstName} ${barber.lastName}`}</p>
                  </button>
                );
              })}

              {/* Tarjeta "Sin barbero": solo visible cuando hay carrito */}
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectNoBarber}
                  className={`relative p-6 rounded-lg border transition-colors hover:border-secondary ${
                    productSaleAssignment === 'no_barber'
                      ? 'border-secondary bg-secondary/5'
                      : 'border-dashed border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  <span className="absolute top-3 left-3 text-xs font-medium text-muted-foreground">
                    {barbers.length + 1}
                  </span>
                  <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-center text-foreground">Sin barbero</p>
                  <p className="text-xs text-center text-muted-foreground mt-0.5">Solo productos</p>
                </button>
              )}
            </div>

            {/* Bloque productos: solo en paso inicial */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Productos</span>
                  {cart.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {productSaleAssignment === 'barber' && cartBarberName
                        ? `· Asignados a ${cartBarberName}`
                        : productSaleAssignment === 'no_barber'
                        ? '· Sin barbero'
                        : '· Elegí barbero o tocá Sin barbero para continuar'}
                    </span>
                  )}
                </div>
                {cart.length > 0 && (
                  <span className="text-sm font-semibold text-foreground">
                    ${subtotalProductos.toLocaleString('es-AR')}
                  </span>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="px-4 py-5 text-center space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Sumá productos a la venta. Después elegí un barbero o tocá "Sin barbero".
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                    disabled={!sucursalId}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Añadir producto
                  </Button>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {cart.map((it) => (
                    <div
                      key={it.producto_sucursal_id}
                      className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-background"
                    >
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{it.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.marca_nombre ? `${it.marca_nombre} · ` : ''}
                          {it.cantidad} × ${it.precio_unitario.toLocaleString('es-AR')}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        ${(it.precio_unitario * it.cantidad).toLocaleString('es-AR')}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setCart(prev => {
                            const next = prev.filter(x => x.producto_sucursal_id !== it.producto_sucursal_id);
                            if (next.length === 0) {
                              setProductSaleAssignment('pending');
                              setCartBarberId(null);
                              setCartBarberName(null);
                            }
                            return next;
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Agregar más productos
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Service Step */}
        {currentStep === 'service' && (() => {
          // Group services by line
          const grouped: { lineId: string | null; lineName: string; lineColor?: string; services: Service[] }[] = [];
          const lineMap = new Map<string | null, Service[]>();
          
          services.forEach(service => {
            const key = service.lineId || null;
            if (!lineMap.has(key)) lineMap.set(key, []);
            lineMap.get(key)!.push(service);
          });

          // Sort services within each group by price ascending
          lineMap.forEach((svcs) => svcs.sort((a, b) => a.price - b.price));

          // Add groups with lines first (sorted by line name), then "Otros"
          const activeLines = lines.filter(l => lineMap.has(l.id));
          activeLines.forEach(line => {
            grouped.push({ lineId: line.id, lineName: line.name, lineColor: line.color, services: lineMap.get(line.id)! });
          });
          const noLine = lineMap.get(null);
          if (noLine) {
            grouped.push({ lineId: null, lineName: 'Otros', lineColor: undefined, services: noLine });
          }

          let globalIndex = 0;

          return (
            <div className="space-y-5">
              {grouped.map((group) => (
                <div key={group.lineId || 'no-line'}>
                  {group.lineName && (
                    <div className="flex items-center gap-2 mb-3">
                      {group.lineColor && (
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.lineColor }} />
                      )}
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{group.lineName}</h3>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.services.map((service) => {
                      globalIndex++;
                      const idx = globalIndex;
                      return (
                        <button
                          key={service.id}
                          onClick={() => handleSelectService(service.id)}
                          className={`relative p-5 rounded-lg border transition-colors text-left hover:border-secondary ${
                            selectedService === service.id
                              ? 'border-secondary bg-secondary/5'
                              : 'border-border bg-card hover:bg-muted/50'
                          }`}
                          style={group.lineColor ? { borderLeftWidth: '3px', borderLeftColor: selectedService === service.id ? undefined : group.lineColor } : undefined}
                        >
                          <span className="absolute top-3 left-3 text-xs font-medium text-muted-foreground">
                            {idx}
                          </span>
                          <div className="flex justify-between items-center pl-6">
                            <span className="font-medium text-foreground">{service.name}</span>
                            <span className="text-lg font-semibold text-foreground">${service.price.toLocaleString()}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Ir a pago sin servicio: solo si hay productos asignados a este barbero y no se eligió servicio */}
              {cart.length > 0 && selectedBarber && !selectedService && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => {
                    setSelectedService('');
                    setSelectedExtras([]);
                    setSelectedDiscount('none');
                    setCurrentStep('payment');
                  }}
                >
                  Ir a pago sin servicio <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })()}

        {/* Extras Step */}
        {currentStep === 'extras' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {extras.map((extra, index) => (
                <button
                  key={extra.id}
                  onClick={() => handleToggleExtra(extra.id)}
                  className={`relative p-4 rounded-lg border transition-colors hover:border-secondary ${
                    selectedExtras.includes(extra.id)
                      ? 'border-secondary bg-secondary/5'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  <span className="absolute top-2 left-2 text-xs font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  {selectedExtras.includes(extra.id) && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  <div className="pt-3">
                    <p className="font-medium text-foreground text-center">{extra.name}</p>
                    <p className="text-sm font-semibold text-muted-foreground text-center mt-1">+${extra.price.toLocaleString()}</p>
                  </div>
                </button>
              ))}
            </div>

            <Button onClick={goToNextStep} className="w-full h-12 bg-foreground hover:bg-foreground/90">
              Continuar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Resumen compacto del carrito en pasos posteriores a 'barber' (solo lectura) */}
        {cart.length > 0 && (currentStep === 'service' || currentStep === 'extras' || currentStep === 'discount') && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground truncate">
                {cart.length} producto{cart.length > 1 ? 's' : ''} · {productSaleAssignment === 'barber' && cartBarberName ? `Asignados a ${cartBarberName}` : productSaleAssignment === 'no_barber' ? 'Sin barbero' : 'Sin asignar'}
              </span>
            </div>
            <span className="font-semibold text-foreground flex-shrink-0">
              ${subtotalProductos.toLocaleString('es-AR')}
            </span>
          </div>
        )}

        {/* Discount Step */}
        {currentStep === 'discount' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {discounts.map((discount, index) => {
              const rounding = discount.rounding || 'cliente';
              const rawCalc = discount.type === 'fixed' 
                ? discount.value 
                : subtotal * (discount.value / 100);
              const calcAmount = discount.type === 'fixed' 
                ? rawCalc 
                : rounding === 'cliente' ? Math.floor(rawCalc) : Math.ceil(rawCalc);
              
              const paymentRestriction = discount.paymentMethod !== 'todos' && discount.id !== 'none';
              const paymentLabel = paymentRestriction ? getMethodLabel(discount.paymentMethod as PaymentMethod) : '';
              
              return (
                <button
                  key={discount.id}
                  onClick={() => handleSelectDiscount(discount.id)}
                  className={`relative p-6 rounded-lg border transition-colors hover:border-secondary ${
                    selectedDiscount === discount.id
                      ? 'border-secondary bg-secondary/5'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  <span className="absolute top-3 left-3 text-xs font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  {paymentRestriction && (
                    <span className="absolute top-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                      Solo {paymentLabel}
                    </span>
                  )}
                  <div className="w-10 h-10 rounded-lg bg-muted mx-auto mb-3 flex items-center justify-center">
                    {discount.value === 0 ? (
                      <Check className="h-5 w-5 text-muted-foreground" />
                    ) : discount.type === 'fixed' ? (
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Percent className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="font-medium text-center text-foreground">{discount.label}</p>
                  {discount.value > 0 && subtotal > 0 && (
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      -${calcAmount.toLocaleString()}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Payment Step */}
        {currentStep === 'payment' && (
          <div className="space-y-6">
            {methodsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activeMethods.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
                <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No hay métodos de pago activos. Activá al menos uno en Mi Negocio.
                </p>
              </div>
            ) : !splitMode ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {activeMethods.map((m, idx) => {
                    const isEfectivo = m.method === 'efectivo';
                    const isSelected = paymentMethod === m.method;
                    const Icon = isEfectivo ? Banknote : CreditCard;
                    const selectedClass = isEfectivo
                      ? 'border-success bg-success/5'
                      : 'border-secondary bg-secondary/5';
                    const hoverClass = isEfectivo ? 'hover:border-success' : 'hover:border-secondary';
                    const iconColor = isSelected
                      ? (isEfectivo ? 'text-success' : 'text-secondary')
                      : 'text-muted-foreground';
                    return (
                      <button
                        key={m.method}
                        onClick={() => handleSelectPayment(m.method)}
                        className={`relative p-6 rounded-lg border transition-colors ${hoverClass} ${
                          isSelected ? selectedClass : 'border-border bg-card hover:bg-muted/50'
                        }`}
                      >
                        <span className="absolute top-3 left-3 text-xs font-medium text-muted-foreground">{idx + 1}</span>
                        <Icon className={`h-9 w-9 mx-auto mb-2 ${iconColor}`} />
                        <p className="font-medium text-center text-foreground">{m.label}</p>
                        {m.recargoPct > 0 && (
                          <p className="text-[11px] text-center text-muted-foreground mt-1">+{m.recargoPct}%</p>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={enableSplitMode}
                  disabled={!isEfectivoActive || electronicMethods.length === 0}
                  title={!isEfectivoActive || electronicMethods.length === 0 ? 'Activá efectivo y al menos un método electrónico en Mi Negocio' : undefined}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                >
                  <Split className="h-4 w-4" />
                  Combinar métodos de pago
                </button>
              </>
            ) : (
              <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Split className="h-4 w-4 text-foreground" />
                    <span className="font-medium text-foreground">Pago combinado</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={cancelSplitMode}>
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                </div>

                {electronicMethods.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Método electrónico</label>
                    <div className="flex flex-wrap gap-2">
                      {electronicMethods.map(m => (
                        <button
                          key={m.method}
                          type="button"
                          onClick={() => setSelectedDigitalMethod(m.method)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            selectedDigitalMethod === m.method
                              ? 'border-secondary bg-secondary/10 text-foreground'
                              : 'border-border text-muted-foreground hover:bg-muted/50'
                          }`}
                        >
                          {getMethodLabel(m.method)}
                          {m.recargoPct > 0 && <span className="ml-1 opacity-70">+{m.recargoPct}%</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-success" /> Efectivo
                      {pctEfectivo > 0 && <span className="text-[11px] text-muted-foreground">+{pctEfectivo}%</span>}
                    </label>
                    <CurrencyInput
                      value={efectivoAmount}
                      onChange={handleEfectivoChange}
                      placeholder="0"
                      className="h-12 text-lg"
                    />
                    {pctEfectivo > 0 && splitEfectivoNum > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        → ${(splitEfectivoNum + Math.round(splitEfectivoNum * pctEfectivo / 100)).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-secondary" />
                      {selectedDigitalMethod ? getMethodLabel(selectedDigitalMethod) : 'Electrónico'}
                      {pctDigital > 0 && <span className="text-[11px] text-muted-foreground">+{pctDigital}%</span>}
                    </label>
                    <CurrencyInput
                      value={mpAmount}
                      onChange={handleMpChange}
                      placeholder="0"
                      className="h-12 text-lg"
                    />
                    {pctDigital > 0 && splitMpNum > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        → ${(splitMpNum + Math.round(splitMpNum * pctDigital / 100)).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                  splitValid ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                }`}>
                  <span>Suma: ${splitSum.toLocaleString()} / Total: ${total.toLocaleString()}</span>
                  {splitValid ? <Check className="h-4 w-4" /> : <span className="text-xs">Debe coincidir exacto</span>}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="space-y-3 text-sm">
                {(() => {
                  let displayBarberName: string | null = null;
                  if (barber) {
                    displayBarberName = `${barber.firstName} ${barber.lastName}`;
                  } else if (cart.length > 0) {
                    if (productSaleAssignment === 'barber' && cartBarberName) {
                      displayBarberName = cartBarberName;
                    } else if (productSaleAssignment === 'no_barber') {
                      displayBarberName = 'Sin barbero';
                    }
                  }
                  if (!displayBarberName) return null;
                  return (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Barbero</span>
                      <span className="font-medium">{displayBarberName}</span>
                    </div>
                  );
                })()}
                {service && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Servicio</span>
                    <span className="font-medium">{service.name}</span>
                  </div>
                )}
                {selectedExtrasData.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extras</span>
                    <span className="font-medium">{selectedExtrasData.map(e => e.name).join(', ')}</span>
                  </div>
                )}
                {cart.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Productos</span>
                      <span className="font-medium">${subtotalProductos.toLocaleString('es-AR')}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pl-2 space-y-0.5">
                      {cart.map(it => (
                        <div key={it.producto_sucursal_id} className="flex justify-between">
                          <span className="truncate pr-2">{it.cantidad}× {it.nombre}</span>
                          <span>${(it.precio_unitario * it.cantidad).toLocaleString('es-AR')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {subtotalServicios > 0 && (
                  <div className="flex justify-between pt-3 border-t border-border">
                    <span className="text-muted-foreground">Subtotal servicios</span>
                    <span className="font-medium">${subtotalServicios.toLocaleString('es-AR')}</span>
                  </div>
                )}
                <div className={`flex justify-between ${subtotalServicios > 0 ? '' : 'pt-3 border-t border-border'}`}>
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${subtotal.toLocaleString('es-AR')}</span>
                </div>
                {selectedDiscountData && selectedDiscountData.value > 0 && (
                  isDiscountValidForPayment ? (
                    <div className="flex justify-between text-success">
                      <span>Descuento ({selectedDiscountData.type === 'fixed' ? `$${selectedDiscountData.value.toLocaleString()}` : `${selectedDiscountData.value}%`})</span>
                      <span className="font-medium">-${discountAmount.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-destructive">
                      <span className="text-xs">Descuento no aplica a este método</span>
                      <span className="font-medium line-through text-muted-foreground">-${
                        selectedDiscountData.type === 'fixed' 
                          ? selectedDiscountData.value.toLocaleString()
                          : (selectedDiscountData.rounding === 'cliente' 
                              ? Math.floor(subtotal * selectedDiscountData.value / 100) 
                              : Math.ceil(subtotal * selectedDiscountData.value / 100)
                            ).toLocaleString()
                      }</span>
                    </div>
                  )
                )}
                {recargoTotal > 0 && (
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">{recargoLabel}</span>
                    <span className="font-medium">+${recargoTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                <span className="text-lg font-medium">Total a cobrar</span>
                <span className="text-3xl font-bold text-foreground">${totalACobrar.toLocaleString()}</span>
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full mt-6 h-14 text-base font-medium bg-secondary text-secondary-foreground hover:bg-secondary/90"
                disabled={!paymentMethod || isSubmitting || (splitMode && !splitValid)}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Guardando...</>
                ) : (
                  <><Check className="h-5 w-5 mr-2" /> Registrar Cobro</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {(currentStepIndex > 0 || cart.length > 0 || !!selectedBarber || !!selectedService) && (
        <div className="flex items-center justify-between gap-2 pt-4 border-t border-border">
          {currentStepIndex > 0 ? (
            <Button variant="ghost" onClick={goToPrevStep} className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          ) : <span />}
          {(cart.length > 0 || !!selectedBarber || !!selectedService || selectedExtras.length > 0 || selectedDiscount !== 'none') && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelOpen(true)}
              className="gap-2 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" /> Cancelar venta
            </Button>
          )}
        </div>
      )}

      {/* Daily Turnos Viewer — solo en el paso inicial */}
      {currentStep === 'barber' && <DailyTurnosViewer />}

      {sucursalId && (
        <ProductoPickerDialog
          open={pickerOpen}
          sucursalId={sucursalId}
          canEditPrice={canEditProductPrice}
          initialCart={cart}
          onClose={() => setPickerOpen(false)}
          onConfirm={(items) => {
            setCart(items);
            // Si el carrito quedó vacío tras editar, resetear asignación.
            if (items.length === 0) {
              setProductSaleAssignment('pending');
              setCartBarberId(null);
              setCartBarberName(null);
            }
          }}
        />
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se va a limpiar el barbero, servicio, extras, descuento, pagos y los productos del carrito. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { resetForm(); setCancelOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cancelar venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {showTasksBubble && pendingTasks.length > 0 && (
        <div
          onClick={() => { setShowTasksBubble(false); onNavigateToTareas?.(); }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-md animate-fade-in cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 shrink-0">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {pendingTasks.length}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Tenés {pendingTasks.length} tarea{pendingTasks.length > 1 ? 's' : ''} pendiente{pendingTasks.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {pendingTasks.slice(0, 2).map(t => t.titulo).join(', ')}
              {pendingTasks.length > 2 ? ` y ${pendingTasks.length - 2} más` : ''}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowTasksBubble(false); }}
            className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
