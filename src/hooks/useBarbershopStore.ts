import { useState, useCallback } from 'react';
import { Service, Extra, Barber, Discount, Transaction } from '@/types/barbershop';
import { toast } from 'sonner';

// Initial demo data
const initialServices: Service[] = [
  { id: '1', name: 'Corte Clásico', price: 3500 },
  { id: '2', name: 'Corte + Barba', price: 5000 },
  { id: '3', name: 'Barba', price: 2000 },
  { id: '4', name: 'Combo Premium', price: 6500 },
];

const initialExtras: Extra[] = [
  { id: '1', name: 'Lavado', price: 500 },
  { id: '2', name: 'Cejas', price: 300 },
  { id: '3', name: 'Máscara Facial', price: 800 },
  { id: '4', name: 'Tinte Barba', price: 1000 },
];

const initialBarbers: Barber[] = [
  { id: '1', name: 'Carlos', active: true },
  { id: '2', name: 'Miguel', active: true },
  { id: '3', name: 'Andrés', active: true },
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

  // Services CRUD
  const addService = useCallback((service: Omit<Service, 'id'>) => {
    const newService = { ...service, id: crypto.randomUUID() };
    setServices(prev => [...prev, newService]);
    return newService;
  }, []);

  const updateService = useCallback((id: string, updates: Partial<Service>) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const deleteService = useCallback((id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  // Extras CRUD
  const addExtra = useCallback((extra: Omit<Extra, 'id'>) => {
    const newExtra = { ...extra, id: crypto.randomUUID() };
    setExtras(prev => [...prev, newExtra]);
    return newExtra;
  }, []);

  const updateExtra = useCallback((id: string, updates: Partial<Extra>) => {
    setExtras(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const deleteExtra = useCallback((id: string) => {
    setExtras(prev => prev.filter(e => e.id !== id));
  }, []);

  // Barbers CRUD
  const addBarber = useCallback((barber: Omit<Barber, 'id'>) => {
    const newBarber = { ...barber, id: crypto.randomUUID() };
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
  const addTransaction = useCallback((transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTransaction = {
      ...transaction,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    // Save to local state
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
    // Data
    services,
    extras,
    barbers: barbers.filter(b => b.active),
    allBarbers: barbers,
    discounts,
    transactions,
    // Services
    addService,
    updateService,
    deleteService,
    // Extras
    addExtra,
    updateExtra,
    deleteExtra,
    // Barbers
    addBarber,
    updateBarber,
    deleteBarber,
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
