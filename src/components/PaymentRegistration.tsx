import { useState, useMemo, useEffect, useCallback } from 'react';
import { CreditCard, Banknote, Check, Percent, ArrowLeft, ArrowRight, User, Sparkles, Wallet, Tag, Scissors, DollarSign, ClipboardList, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Service, Extra, Barber, Discount, PaymentMethod, DiscountType } from '@/types/barbershop';
import { useTareas } from '@/hooks/useTareas';

interface PaymentRegistrationProps {
  services: Service[];
  extras: Extra[];
  barbers: Barber[];
  discounts: Discount[];
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
    subtotal: number;
    total: number;
  }) => void;
}

type Step = 'barber' | 'service' | 'extras' | 'discount' | 'payment';

const STEPS: Step[] = ['barber', 'service', 'extras', 'discount', 'payment'];

const STEP_INFO = {
  barber: { title: 'Barbero', subtitle: 'Selecciona quién atendió', icon: User },
  service: { title: 'Servicio', subtitle: 'Selecciona el servicio principal', icon: Scissors },
  extras: { title: 'Extras', subtitle: 'Agrega extras opcionales', icon: Sparkles },
  discount: { title: 'Descuento', subtitle: 'Aplica un descuento si corresponde', icon: Tag },
  payment: { title: 'Método de Pago', subtitle: 'Selecciona cómo paga el cliente', icon: Wallet },
};

export function PaymentRegistration({ services, extras, barbers, discounts, onSubmit }: PaymentRegistrationProps) {
  const { toast } = useToast();
  const { tareas } = useTareas();
  const [currentStep, setCurrentStep] = useState<Step>('barber');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedDiscount, setSelectedDiscount] = useState('none');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [showTasksBubble, setShowTasksBubble] = useState(true);

  const pendingTasks = useMemo(() => 
    tareas.filter(t => t.estado === 'pendiente'),
    [tareas]
  );

  const currentStepIndex = STEPS.indexOf(currentStep);
  const service = useMemo(() => services.find(s => s.id === selectedService), [services, selectedService]);
  const barber = useMemo(() => barbers.find(b => b.uid === selectedBarber), [barbers, selectedBarber]);
  const selectedExtrasData = useMemo(() =>
    extras.filter(e => selectedExtras.includes(e.id)),
    [extras, selectedExtras]
  );

  const subtotal = useMemo(() => {
    const servicePrice = service?.price || 0;
    const extrasTotal = selectedExtrasData.reduce((sum, e) => sum + e.price, 0);
    return servicePrice + extrasTotal;
  }, [service, selectedExtrasData]);

  const selectedDiscountData = useMemo(() => {
    return discounts.find(d => d.id === selectedDiscount);
  }, [discounts, selectedDiscount]);

  // Check if selected discount is valid for the payment method
  const isDiscountValidForPayment = useMemo(() => {
    if (!selectedDiscountData || !paymentMethod) return true;
    if (selectedDiscountData.paymentMethod === 'todos') return true;
    return selectedDiscountData.paymentMethod === paymentMethod;
  }, [selectedDiscountData, paymentMethod]);

  const discountAmount = useMemo(() => {
    if (!selectedDiscountData || selectedDiscountData.value === 0) return 0;
    // If discount doesn't apply to selected payment method, no discount
    if (!isDiscountValidForPayment) return 0;
    
    if (selectedDiscountData.type === 'fixed') {
      return selectedDiscountData.value;
    }
    // percentage with rounding
    const rawDiscount = subtotal * (selectedDiscountData.value / 100);
    const rounding = selectedDiscountData.rounding || 'cliente';
    const unit = selectedDiscountData.roundingUnit || 1;
    
    // Apply rounding based on type and unit
    let roundedDiscount: number;
    if (unit === 1) {
      // No unit rounding, just apply direction
      switch (rounding) {
        case 'negocio': roundedDiscount = Math.ceil(rawDiscount); break;
        case 'matematico': roundedDiscount = Math.round(rawDiscount); break;
        default: roundedDiscount = Math.floor(rawDiscount); break;
      }
    } else {
      // Apply unit-based rounding
      switch (rounding) {
        case 'negocio': roundedDiscount = Math.ceil(rawDiscount / unit) * unit; break;
        case 'matematico': roundedDiscount = Math.round(rawDiscount / unit) * unit; break;
        default: roundedDiscount = Math.floor(rawDiscount / unit) * unit; break;
      }
    }
    
    return roundedDiscount;
  }, [subtotal, selectedDiscountData, isDiscountValidForPayment]);

  const total = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);

  const goToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  }, [currentStepIndex]);

  const goToPrevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  }, [currentStepIndex]);

  const handleSelectBarber = useCallback((barberId: string) => {
    setSelectedBarber(barberId);
    setTimeout(() => goToNextStep(), 100);
  }, [goToNextStep]);

  const handleSelectService = useCallback((serviceId: string) => {
    setSelectedService(serviceId);
    setTimeout(() => goToNextStep(), 100);
  }, [goToNextStep]);

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
    setPaymentMethod(method);
  }, []);

  const resetForm = useCallback(() => {
    setSelectedBarber('');
    setSelectedService('');
    setSelectedExtras([]);
    setSelectedDiscount('none');
    setPaymentMethod('');
    setCurrentStep('barber');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedBarber || !selectedService || !paymentMethod) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los pasos.",
        variant: "destructive",
      });
      return;
    }

    onSubmit({
      barberId: barber!.id,
      barberName: `${barber!.firstName} ${barber!.lastName}`,
      serviceId: service!.id,
      serviceName: service!.name,
      servicePrice: service!.price,
      extras: selectedExtrasData.map(e => ({ uid: e.id, name: e.name, price: e.price })),
      discount: selectedDiscountData?.value || 0,
      discountType: selectedDiscountData?.type || 'percentage',
      paymentMethod,
      subtotal,
      total,
    });

    toast({
      title: "Cobro registrado",
      description: `$${total.toLocaleString()} - ${service!.name}`,
    });

    resetForm();
  }, [selectedBarber, selectedService, paymentMethod, barber, service, selectedExtrasData, selectedDiscountData, subtotal, total, onSubmit, toast, resetForm]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;

        if (currentStep === 'barber' && barbers[index]) {
          handleSelectBarber(barbers[index].uid);
        } else if (currentStep === 'service' && services[index]) {
          handleSelectService(services[index].id);
        } else if (currentStep === 'extras' && extras[index]) {
          handleToggleExtra(extras[index].id);
        } else if (currentStep === 'discount' && discounts[index]) {
          handleSelectDiscount(discounts[index].id);
        } else if (currentStep === 'payment') {
          if (index === 0) handleSelectPayment('efectivo');
          if (index === 1) handleSelectPayment('mercado_pago');
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
  }, [currentStep, barbers, services, extras, discounts, paymentMethod, selectedBarber, selectedService, handleSelectBarber, handleSelectService, handleToggleExtra, handleSelectDiscount, handleSelectPayment, goToNextStep, goToPrevStep, handleSubmit]);

  const StepIcon = STEP_INFO[currentStep].icon;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Pending Tasks Bubble */}
      {showTasksBubble && pendingTasks.length > 0 && (
        <div className="relative flex items-center gap-3 rounded-lg border border-accent bg-accent/10 p-3 animate-fade-in">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-accent-foreground shrink-0">
            <ClipboardList className="h-4 w-4" />
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
            onClick={() => setShowTasksBubble(false)}
            className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
              className={`flex-1 h-1.5 rounded-full transition-all ${
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {barbers.map((barber, index) => (
              <button
                key={barber.uid}
                onClick={() => handleSelectBarber(barber.uid)}
                className={`relative p-6 rounded-lg border transition-all hover:border-secondary ${
                  selectedBarber === barber.uid
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
            ))}
          </div>
        )}

        {/* Service Step */}
        {currentStep === 'service' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((service, index) => (
              <button
                key={service.id}
                onClick={() => handleSelectService(service.id)}
                className={`relative p-5 rounded-lg border transition-all text-left hover:border-secondary ${
                  selectedService === service.id
                    ? 'border-secondary bg-secondary/5'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <span className="absolute top-3 left-3 text-xs font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <div className="flex justify-between items-center pl-6">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{service.name}</span>
                    {service.lineName && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground w-fit">{service.lineName}</span>
                    )}
                  </div>
                  <span className="text-lg font-semibold text-foreground">${service.price.toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Extras Step */}
        {currentStep === 'extras' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {extras.map((extra, index) => (
                <button
                  key={extra.id}
                  onClick={() => handleToggleExtra(extra.id)}
                  className={`relative p-4 rounded-lg border transition-all hover:border-secondary ${
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
              const paymentLabel = discount.paymentMethod === 'efectivo' ? 'Efectivo' : 
                                   discount.paymentMethod === 'mercado_pago' ? 'MP' : '';
              
              return (
                <button
                  key={discount.id}
                  onClick={() => handleSelectDiscount(discount.id)}
                  className={`relative p-6 rounded-lg border transition-all hover:border-secondary ${
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
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSelectPayment('efectivo')}
                className={`relative p-8 rounded-lg border transition-all hover:border-success ${
                  paymentMethod === 'efectivo'
                    ? 'border-success bg-success/5'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <span className="absolute top-3 left-3 text-xs font-medium text-muted-foreground">1</span>
                <Banknote className={`h-10 w-10 mx-auto mb-3 ${paymentMethod === 'efectivo' ? 'text-success' : 'text-muted-foreground'}`} />
                <p className="font-medium text-center text-foreground">Efectivo</p>
              </button>
              <button
                onClick={() => handleSelectPayment('mercado_pago')}
                className={`relative p-8 rounded-lg border transition-all hover:border-secondary ${
                  paymentMethod === 'mercado_pago'
                    ? 'border-secondary bg-secondary/5'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <span className="absolute top-3 left-3 text-xs font-medium text-muted-foreground">2</span>
                <CreditCard className={`h-10 w-10 mx-auto mb-3 ${paymentMethod === 'mercado_pago' ? 'text-secondary' : 'text-muted-foreground'}`} />
                <p className="font-medium text-center text-foreground">Mercado Pago</p>
              </button>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Barbero</span>
                  <span className="font-medium">{barber ? `${barber.firstName} ${barber.lastName}` : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Servicio</span>
                  <span className="font-medium">{service?.name}</span>
                </div>
                {selectedExtrasData.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extras</span>
                    <span className="font-medium">{selectedExtrasData.map(e => e.name).join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-border">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${subtotal.toLocaleString()}</span>
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
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                <span className="text-lg font-medium">Total</span>
                <span className="text-3xl font-bold text-foreground">${total.toLocaleString()}</span>
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full mt-6 h-14 text-base font-medium bg-secondary text-secondary-foreground hover:bg-secondary/90"
                disabled={!paymentMethod}
              >
                <Check className="h-5 w-5 mr-2" />
                Registrar Cobro
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {currentStepIndex > 0 && (
        <div className="flex justify-start pt-4 border-t border-border">
          <Button variant="ghost" onClick={goToPrevStep} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        </div>
      )}
    </div>
  );
}
