import { useState, useCallback } from 'react';
import { Service, Extra, Barber, Discount, Transaction } from '@/types/barbershop';
import { toast } from 'sonner';

// Generate unique UIDs
function generateUID(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}-${timestamp}-${randomPart}`.toUpperCase();
}

const initialDiscounts: Discount[] = [
  { id: 'none', label: 'Sin descuento', value: 0, type: 'percentage' },
  { id: '10', label: '10%', value: 10, type: 'percentage' },
  { id: '20', label: '20%', value: 20, type: 'percentage' },
  { id: '30', label: '30%', value: 30, type: 'percentage' },
  { id: '50', label: '50%', value: 50, type: 'percentage' },
];

export function useBarbershopStore() {
  const [services, setServices] = useState<Service[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>(initialDiscounts);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading] = useState(false);

  // Services CRUD (local only)
  const addService = useCallback((service: Omit<Service, 'id' | 'uid'>) => {
    const newService: Service = { 
      ...service, 
      id: crypto.randomUUID(),
      uid: generateUID('SVC'),
    };
    setServices(prev => [...prev, newService]);
    toast.success('Servicio agregado');
    return newService;
  }, []);

  const updateService = useCallback((id: string, updates: Partial<Service>) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  // Extras CRUD (local only)
  const addExtra = useCallback((extra: Omit<Extra, 'id' | 'uid'>) => {
    const newExtra: Extra = { 
      ...extra, 
      id: crypto.randomUUID(),
      uid: generateUID('EXT'),
    };
    setExtras(prev => [...prev, newExtra]);
    toast.success('Extra agregado');
    return newExtra;
  }, []);

  const updateExtra = useCallback((id: string, updates: Partial<Extra>) => {
    setExtras(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  // Barbers CRUD (local only)
  const addBarber = useCallback((barber: Omit<Barber, 'id' | 'uid'>) => {
    const newBarber: Barber = { 
      ...barber, 
      id: crypto.randomUUID(),
      uid: generateUID('STF'),
    };
    setBarbers(prev => [...prev, newBarber]);
    toast.success('Barbero agregado');
    return newBarber;
  }, []);

  const updateBarber = useCallback((id: string, updates: Partial<Barber>) => {
    setBarbers(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  // Discounts CRUD (local only)
  const addDiscount = useCallback((discount: Omit<Discount, 'id'>) => {
    const newDiscount = { ...discount, id: crypto.randomUUID() };
    setDiscounts(prev => [...prev, newDiscount]);
    return newDiscount;
  }, []);

  const updateDiscount = useCallback((id: string, updates: Partial<Discount>) => {
    setDiscounts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const deleteDiscount = useCallback((id: string) => {
    if (id === 'none') return;
    setDiscounts(prev => prev.filter(d => d.id !== id));
  }, []);

  // Transactions (local only)
  const addTransaction = useCallback((transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: crypto.randomUUID(),
      createdAt: new Date(),
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
    // Loading state
    isLoading,
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
