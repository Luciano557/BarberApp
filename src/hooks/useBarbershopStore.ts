import { useState, useCallback, useEffect } from 'react';
import { Service, Extra, Barber, Discount, Transaction } from '@/types/barbershop';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Generate unique UIDs
function generateUID(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}-${timestamp}-${randomPart}`.toUpperCase();
}

// Initial demo data
const initialServices: Service[] = [
  { id: '1', uid: generateUID('SVC'), name: 'Corte Clásico', price: 3500, active: true },
  { id: '2', uid: generateUID('SVC'), name: 'Corte + Barba', price: 5000, active: true },
  { id: '3', uid: generateUID('SVC'), name: 'Barba', price: 2000, active: true },
  { id: '4', uid: generateUID('SVC'), name: 'Combo Premium', price: 6500, active: true },
];

const initialExtras: Extra[] = [
  { id: '1', uid: generateUID('EXT'), name: 'Lavado', price: 500, active: true },
  { id: '2', uid: generateUID('EXT'), name: 'Cejas', price: 300, active: true },
  { id: '3', uid: generateUID('EXT'), name: 'Máscara Facial', price: 800, active: true },
  { id: '4', uid: generateUID('EXT'), name: 'Tinte Barba', price: 1000, active: true },
];

const initialBarbers: Barber[] = [
  { id: '1', uid: generateUID('STF'), firstName: 'Carlos', lastName: 'García', phone: '1122334455', commission: 40, active: true },
  { id: '2', uid: generateUID('STF'), firstName: 'Miguel', lastName: 'López', phone: '1133445566', commission: 35, active: true },
  { id: '3', uid: generateUID('STF'), firstName: 'Andrés', lastName: 'Martínez', phone: '1144556677', commission: 45, active: true },
];

const initialDiscounts: Discount[] = [
  { id: 'none', label: 'Sin descuento', value: 0 },
  { id: '10', label: '10%', value: 10 },
  { id: '20', label: '20%', value: 20 },
  { id: '30', label: '30%', value: 30 },
  { id: '50', label: '50%', value: 50 },
];

export function useBarbershopStore() {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [extras, setExtras] = useState<Extra[]>(initialExtras);
  const [barbers, setBarbers] = useState<Barber[]>(initialBarbers);
  const [discounts, setDiscounts] = useState<Discount[]>(initialDiscounts);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Cargar transacciones de hoy desde Supabase al iniciar
  useEffect(() => {
    const loadTodayTransactions = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('transacciones')
        .select('*')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading transactions:', error);
        return;
      }

      if (data) {
        const mappedTransactions: Transaction[] = data.map((t) => ({
          id: t.id,
          barberId: t.barbero_id,
          barberName: t.barbero_nombre,
          serviceId: t.servicio_id,
          serviceName: t.servicio_nombre,
          servicePrice: Number(t.servicio_precio),
          extras: (t.extras as { id: string; name: string; price: number }[]) || [],
          discount: Number(t.descuento),
          discountType: (t.tipo_descuento as 'fixed' | 'percentage') || 'percentage',
          paymentMethod: t.metodo_pago as 'efectivo' | 'mercado_pago',
          subtotal: Number(t.subtotal),
          total: Number(t.total),
          createdAt: new Date(t.created_at),
        }));
        setTransactions(mappedTransactions);
      }
    };

    loadTodayTransactions();
  }, []);

  // Services CRUD
  const addService = useCallback((service: Omit<Service, 'id' | 'uid'>) => {
    const newService = { 
      ...service, 
      id: crypto.randomUUID(),
      uid: generateUID('SVC'),
    };
    setServices(prev => [...prev, newService]);
    return newService;
  }, []);

  const updateService = useCallback((id: string, updates: Partial<Service>) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  // Extras CRUD
  const addExtra = useCallback((extra: Omit<Extra, 'id' | 'uid'>) => {
    const newExtra = { 
      ...extra, 
      id: crypto.randomUUID(),
      uid: generateUID('EXT'),
    };
    setExtras(prev => [...prev, newExtra]);
    return newExtra;
  }, []);

  const updateExtra = useCallback((id: string, updates: Partial<Extra>) => {
    setExtras(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  // Barbers CRUD
  const addBarber = useCallback((barber: Omit<Barber, 'id' | 'uid'>) => {
    const newBarber = { 
      ...barber, 
      id: crypto.randomUUID(),
      uid: generateUID('STF'),
    };
    setBarbers(prev => [...prev, newBarber]);
    return newBarber;
  }, []);

  const updateBarber = useCallback((id: string, updates: Partial<Barber>) => {
    setBarbers(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const deleteBarber = useCallback((id: string) => {
    setBarbers(prev => prev.filter(b => b.id !== id));
  }, []);

  // Discounts CRUD
  const addDiscount = useCallback((discount: Omit<Discount, 'id'>) => {
    const newDiscount = { ...discount, id: crypto.randomUUID() };
    setDiscounts(prev => [...prev, newDiscount]);
    return newDiscount;
  }, []);

  const updateDiscount = useCallback((id: string, updates: Partial<Discount>) => {
    setDiscounts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const deleteDiscount = useCallback((id: string) => {
    // Don't allow deleting "Sin descuento" option
    if (id === 'none') return;
    setDiscounts(prev => prev.filter(d => d.id !== id));
  }, []);

  // Transactions
  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    // Guardar en Supabase
    const { data, error } = await supabase
      .from('transacciones')
      .insert({
        barbero_id: transaction.barberId,
        barbero_nombre: transaction.barberName,
        servicio_id: transaction.serviceId,
        servicio_nombre: transaction.serviceName,
        servicio_precio: transaction.servicePrice,
        extras: transaction.extras,
        descuento: transaction.discount,
        tipo_descuento: transaction.discountType,
        metodo_pago: transaction.paymentMethod,
        subtotal: transaction.subtotal,
        total: transaction.total,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving transaction:', error);
      toast.error('Error al guardar el cobro');
      return null;
    }

    const newTransaction: Transaction = {
      id: data.id,
      barberId: data.barbero_id,
      barberName: data.barbero_nombre,
      serviceId: data.servicio_id,
      serviceName: data.servicio_nombre,
      servicePrice: Number(data.servicio_precio),
      extras: (data.extras as { id: string; name: string; price: number }[]) || [],
      discount: Number(data.descuento),
      discountType: (data.tipo_descuento as 'fixed' | 'percentage') || 'percentage',
      paymentMethod: data.metodo_pago as 'efectivo' | 'mercado_pago',
      subtotal: Number(data.subtotal),
      total: Number(data.total),
      createdAt: new Date(data.created_at),
    };

    setTransactions(prev => [newTransaction, ...prev]);
    toast.success('Cobro registrado correctamente');

    return newTransaction;
  }, []);

  const getTodayTransactions = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return transactions.filter(t => new Date(t.createdAt) >= today);
  }, [transactions]);

  const getDailySummary = useCallback(() => {
    const todayTx = getTodayTransactions();
    const totalEfectivo = todayTx
      .filter(t => t.paymentMethod === 'efectivo')
      .reduce((sum, t) => sum + t.total, 0);
    const totalMercadoPago = todayTx
      .filter(t => t.paymentMethod === 'mercado_pago')
      .reduce((sum, t) => sum + t.total, 0);

    return {
      count: todayTx.length,
      totalEfectivo,
      totalMercadoPago,
      total: totalEfectivo + totalMercadoPago,
      transactions: todayTx,
    };
  }, [getTodayTransactions]);

  return {
    // Data - active items only for operations
    services: services.filter(s => s.active),
    allServices: services,
    extras: extras.filter(e => e.active),
    allExtras: extras,
    barbers: barbers.filter(b => b.active),
    allBarbers: barbers,
    discounts,
    transactions,
    // Services
    addService,
    updateService,
    // Extras
    addExtra,
    updateExtra,
    // Barbers
    addBarber,
    updateBarber,
    // Discounts
    addDiscount,
    updateDiscount,
    deleteDiscount,
    // Transactions
    addTransaction,
    getTodayTransactions,
    getDailySummary,
  };
}
