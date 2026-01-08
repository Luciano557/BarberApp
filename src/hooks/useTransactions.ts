import { useState, useCallback, useEffect } from 'react';
import { Transaction } from '@/types/barbershop';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VentaInsert {
  barbero_id: string;
  barbero_nombre: string;
  servicio_id: string;
  servicio_nombre: string;
  precio_servicio: number;
  descuento_pct: number;
  metodo_pago: 'efectivo' | 'mercado_pago';
  total_final: number;
}

interface VentaExtraInsert {
  venta_id: string;
  extra_id: string;
  extra_nombre: string;
  precio_extra: number;
  cantidad: number;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Cargar ventas de una fecha específica desde Supabase
  const loadTransactionsByDate = useCallback(async (date: Date) => {
    setIsLoading(true);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: ventas, error } = await supabase
      .from('venta')
      .select('*')
      .gte('fecha_hora', startOfDay.toISOString())
      .lte('fecha_hora', endOfDay.toISOString())
      .order('fecha_hora', { ascending: false });

    if (error) {
      console.error('Error loading ventas:', error);
      setIsLoading(false);
      return;
    }

    if (!ventas || ventas.length === 0) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    // Cargar extras de cada venta
    const ventaIds = ventas.map(v => v.id);
    const { data: ventaExtras } = await supabase
      .from('venta_extra')
      .select('*')
      .in('venta_id', ventaIds);

    const extrasMap = new Map<string, { uid: string; name: string; price: number }[]>();
    ventaExtras?.forEach(ve => {
      const list = extrasMap.get(ve.venta_id) || [];
      list.push({
        uid: ve.extra_id,
        name: ve.extra_nombre,
        price: Number(ve.precio_extra),
      });
      extrasMap.set(ve.venta_id, list);
    });

    const txs: Transaction[] = ventas.map(v => ({
      id: v.id,
      barberId: v.barbero_id,
      barberName: v.barbero_nombre,
      serviceId: v.servicio_id,
      serviceName: v.servicio_nombre,
      servicePrice: Number(v.precio_servicio),
      extras: extrasMap.get(v.id) || [],
      discount: Number(v.descuento_pct) || 0,
      discountType: 'percentage' as const,
      paymentMethod: v.metodo_pago as 'efectivo' | 'mercado_pago',
      subtotal: Number(v.precio_servicio) + (extrasMap.get(v.id) || []).reduce((s, e) => s + e.price, 0),
      total: Number(v.total_final),
      createdAt: new Date(v.fecha_hora),
    }));

    setTransactions(txs);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadTransactionsByDate(selectedDate);
  }, [selectedDate, loadTransactionsByDate]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    // Insertar venta principal
    const ventaData: VentaInsert = {
      barbero_id: transaction.barberId,
      barbero_nombre: transaction.barberName,
      servicio_id: transaction.serviceId,
      servicio_nombre: transaction.serviceName,
      precio_servicio: transaction.servicePrice,
      descuento_pct: transaction.discount,
      metodo_pago: transaction.paymentMethod,
      total_final: transaction.total,
    };

    const { data: venta, error: ventaError } = await supabase
      .from('venta')
      .insert(ventaData)
      .select()
      .single();

    if (ventaError) {
      console.error('Error inserting venta:', ventaError);
      toast.error('Error al registrar la venta');
      return null;
    }

    // Insertar extras si hay
    if (transaction.extras.length > 0) {
      const extrasData: VentaExtraInsert[] = transaction.extras.map(e => ({
        venta_id: venta.id,
        extra_id: e.uid,
        extra_nombre: e.name,
        precio_extra: e.price,
        cantidad: 1,
      }));

      const { error: extrasError } = await supabase
        .from('venta_extra')
        .insert(extrasData);

      if (extrasError) {
        console.error('Error inserting extras:', extrasError);
      }
    }

    // Agregar al estado local
    const newTransaction: Transaction = {
      ...transaction,
      id: venta.id,
      createdAt: new Date(venta.fecha_hora),
    };

    setTransactions(prev => [newTransaction, ...prev]);
    toast.success('Cobro registrado correctamente');
    return newTransaction;
  }, []);

  const getTodayTransactions = useCallback(() => {
    return transactions;
  }, [transactions]);

  const getDailySummary = useCallback(() => {
    const todayTx = transactions;
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
  }, [transactions]);

  return {
    transactions,
    isLoading,
    selectedDate,
    setSelectedDate,
    addTransaction,
    getTodayTransactions,
    getDailySummary,
    refetch: () => loadTransactionsByDate(selectedDate),
  };
}
