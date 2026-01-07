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

const initialDiscounts: Discount[] = [
  { id: 'none', label: 'Sin descuento', value: 0 },
  { id: '10', label: '10%', value: 10 },
  { id: '20', label: '20%', value: 20 },
  { id: '30', label: '30%', value: 30 },
  { id: '50', label: '50%', value: 50 },
];

export function useBarbershopStore() {
  const [services, setServices] = useState<Service[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>(initialDiscounts);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar datos desde Supabase al iniciar
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Cargar servicios, extras, barberos y transacciones en paralelo
      const [servicesRes, extrasRes, barbersRes, transactionsRes] = await Promise.all([
        supabase.from('servicios').select('*').order('created_at', { ascending: true }),
        supabase.from('extras').select('*').order('created_at', { ascending: true }),
        supabase.from('barberos').select('*').order('created_at', { ascending: true }),
        supabase.from('transacciones').select('*')
          .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
          .order('created_at', { ascending: false }),
      ]);

      // Mapear servicios
      if (servicesRes.data && servicesRes.data.length > 0) {
        setServices(servicesRes.data.map(s => ({
          id: s.id,
          uid: s.uid,
          name: s.name,
          price: Number(s.price),
          active: s.active,
        })));
      }

      // Mapear extras
      if (extrasRes.data && extrasRes.data.length > 0) {
        setExtras(extrasRes.data.map(e => ({
          id: e.id,
          uid: e.uid,
          name: e.name,
          price: Number(e.price),
          active: e.active,
        })));
      }

      // Mapear barberos
      if (barbersRes.data && barbersRes.data.length > 0) {
        setBarbers(barbersRes.data.map(b => ({
          id: b.id,
          uid: b.uid,
          firstName: b.first_name,
          lastName: b.last_name,
          phone: b.phone,
          commission: Number(b.commission),
          address: b.address || undefined,
          dni: b.dni || undefined,
          active: b.active,
        })));
      }

      // Mapear transacciones
      if (transactionsRes.data) {
        const mappedTransactions: Transaction[] = transactionsRes.data.map((t) => {
          const rawExtras = (t.extras as { id?: string; uid?: string; name: string; price: number }[]) || [];
          const mappedExtras = rawExtras.map(e => ({
            uid: e.uid || e.id || '',
            name: e.name,
            price: e.price,
          }));

          return {
            id: t.id,
            barberId: t.barbero_id,
            barberName: t.barbero_nombre,
            serviceId: t.servicio_id,
            serviceName: t.servicio_nombre,
            servicePrice: Number(t.servicio_precio),
            extras: mappedExtras,
            discount: Number(t.descuento),
            discountType: (t.tipo_descuento as 'fixed' | 'percentage') || 'percentage',
            paymentMethod: t.metodo_pago as 'efectivo' | 'mercado_pago',
            subtotal: Number(t.subtotal),
            total: Number(t.total),
            createdAt: new Date(t.created_at),
          };
        });
        setTransactions(mappedTransactions);
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  // Services CRUD
  const addService = useCallback(async (service: Omit<Service, 'id' | 'uid'>) => {
    const newService: Service = { 
      ...service, 
      id: crypto.randomUUID(),
      uid: generateUID('SVC'),
    };

    const { error } = await supabase.from('servicios').insert({
      id: newService.id,
      uid: newService.uid,
      name: newService.name,
      price: newService.price,
      active: newService.active,
    });

    if (error) {
      console.error('Error adding service:', error);
      toast.error('Error al agregar servicio');
      return newService;
    }

    setServices(prev => [...prev, newService]);
    toast.success('Servicio agregado');
    return newService;
  }, []);

  const updateService = useCallback(async (id: string, updates: Partial<Service>) => {
    const { error } = await supabase.from('servicios').update(updates).eq('id', id);

    if (error) {
      console.error('Error updating service:', error);
      toast.error('Error al actualizar servicio');
      return;
    }

    setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  // Extras CRUD
  const addExtra = useCallback(async (extra: Omit<Extra, 'id' | 'uid'>) => {
    const newExtra: Extra = { 
      ...extra, 
      id: crypto.randomUUID(),
      uid: generateUID('EXT'),
    };

    const { error } = await supabase.from('extras').insert({
      id: newExtra.id,
      uid: newExtra.uid,
      name: newExtra.name,
      price: newExtra.price,
      active: newExtra.active,
    });

    if (error) {
      console.error('Error adding extra:', error);
      toast.error('Error al agregar extra');
      return newExtra;
    }

    setExtras(prev => [...prev, newExtra]);
    toast.success('Extra agregado');
    return newExtra;
  }, []);

  const updateExtra = useCallback(async (id: string, updates: Partial<Extra>) => {
    const { error } = await supabase.from('extras').update(updates).eq('id', id);

    if (error) {
      console.error('Error updating extra:', error);
      toast.error('Error al actualizar extra');
      return;
    }

    setExtras(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  // Barbers CRUD
  const addBarber = useCallback(async (barber: Omit<Barber, 'id' | 'uid'>) => {
    const newBarber: Barber = { 
      ...barber, 
      id: crypto.randomUUID(),
      uid: generateUID('STF'),
    };

    const { error } = await supabase.from('barberos').insert({
      id: newBarber.id,
      uid: newBarber.uid,
      first_name: newBarber.firstName,
      last_name: newBarber.lastName,
      phone: newBarber.phone,
      commission: newBarber.commission,
      address: newBarber.address || null,
      dni: newBarber.dni || null,
      active: newBarber.active,
    });

    if (error) {
      console.error('Error adding barber:', error);
      toast.error('Error al agregar barbero');
      return newBarber;
    }

    setBarbers(prev => [...prev, newBarber]);
    toast.success('Barbero agregado');
    return newBarber;
  }, []);

  const updateBarber = useCallback(async (id: string, updates: Partial<Barber>) => {
    // Mapear camelCase a snake_case para Supabase
    const dbUpdates: Record<string, unknown> = {};
    if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
    if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.commission !== undefined) dbUpdates.commission = updates.commission;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.dni !== undefined) dbUpdates.dni = updates.dni;
    if (updates.active !== undefined) dbUpdates.active = updates.active;

    const { error } = await supabase.from('barberos').update(dbUpdates).eq('id', id);

    if (error) {
      console.error('Error updating barber:', error);
      toast.error('Error al actualizar barbero');
      return;
    }

    setBarbers(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  // Discounts CRUD (local only for now)
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

  // Transactions
  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
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

    const rawExtras = (data.extras as { id?: string; uid?: string; name: string; price: number }[]) || [];
    const mappedExtras = rawExtras.map(e => ({
      uid: e.uid || e.id || '',
      name: e.name,
      price: e.price,
    }));

    const newTransaction: Transaction = {
      id: data.id,
      barberId: data.barbero_id,
      barberName: data.barbero_nombre,
      serviceId: data.servicio_id,
      serviceName: data.servicio_nombre,
      servicePrice: Number(data.servicio_precio),
      extras: mappedExtras,
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
