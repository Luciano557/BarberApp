import { useState, useCallback, useEffect } from 'react';
import { Transaction } from '@/types/barbershop';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { format } from 'date-fns';
import { getStartOfDayLocal, getEndOfDayLocal, formatDateForQuery } from '@/lib/dateUtils';

interface VentaInsert {
  barbero_id: string;
  barbero_nombre: string;
  servicio_id: string;
  servicio_nombre: string;
  precio_servicio: number;
  descuento_pct: number;
  metodo_pago: 'efectivo' | 'mercado_pago';
  total_final: number;
  organization_id: string;
}

interface VentaExtraInsert {
  venta_id: string;
  extra_id: string;
  extra_nombre: string;
  precio_extra: number;
  cantidad: number;
}

export function useTransactions() {
  const { organization } = useOrganization();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Cargar ventas de una fecha específica desde Supabase
  const loadTransactionsByDate = useCallback(async (date: Date) => {
    setIsLoading(true);
    
    // Usar funciones de fecha consistentes que no dependen de toISOString()
    const startStr = getStartOfDayLocal(date);
    const endStr = getEndOfDayLocal(date);

    const { data: ventas, error } = await supabase
      .from('venta')
      .select('*')
      .gte('fecha_hora', startStr)
      .lte('fecha_hora', endStr)
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
      estado: (v as any).estado || 'activo',
      anuladoAt: (v as any).anulado_at ? new Date((v as any).anulado_at) : undefined,
      anuladoPor: (v as any).anulado_por || undefined,
      anuladoPorId: (v as any).anulado_por_id || undefined,
    }));

    setTransactions(txs);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadTransactionsByDate(selectedDate);
  }, [selectedDate, loadTransactionsByDate]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (!organization) {
      toast.error('Error: No se encontró la organización');
      return null;
    }

    // Normalize names to avoid spacing issues
    const normalizedBarberName = transaction.barberName.replace(/\s+/g, ' ').trim();
    const normalizedServiceName = transaction.serviceName.replace(/\s+/g, ' ').trim();

    // Insertar venta principal
    const ventaData: VentaInsert = {
      barbero_id: transaction.barberId,
      barbero_nombre: normalizedBarberName,
      servicio_id: transaction.serviceId,
      servicio_nombre: normalizedServiceName,
      precio_servicio: transaction.servicePrice,
      descuento_pct: transaction.discount,
      metodo_pago: transaction.paymentMethod,
      total_final: transaction.total,
      organization_id: organization.id,
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
  }, [organization]);

  // Anular una transacción (soft delete)
  const voidTransaction = useCallback(async (
    transactionId: string, 
    voidedBy: string, 
    voidedById: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('venta')
        .update({
          estado: 'anulado',
          anulado_at: new Date().toISOString(),
          anulado_por: voidedBy,
          anulado_por_id: voidedById,
        })
        .eq('id', transactionId);

      if (error) {
        console.error('Error voiding transaction:', error);
        toast.error('Error al anular la transacción');
        return false;
      }

      // Actualizar estado local
      setTransactions(prev => prev.map(tx => 
        tx.id === transactionId 
          ? { 
              ...tx, 
              estado: 'anulado' as const, 
              anuladoAt: new Date(), 
              anuladoPor: voidedBy,
              anuladoPorId: voidedById 
            } 
          : tx
      ));

      return true;
    } catch (error) {
      console.error('Error voiding transaction:', error);
      toast.error('Error al anular la transacción');
      return false;
    }
  }, []);

  // Verificar si un barbero tiene la caja cerrada para una fecha
  const isBarberCashClosed = useCallback(async (barberId: string, barberName: string, date: Date): Promise<boolean> => {
    const startStr = getStartOfDayLocal(date);
    const endStr = getEndOfDayLocal(date);
    
    const { data, error } = await supabase
      .from('ingresos')
      .select('id, estado')
      .eq('barbero', barberName)
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .neq('estado', 'eliminado')
      .limit(1);

    if (error) {
      console.error('Error checking cash closing:', error);
      return false;
    }

    return data && data.length > 0;
  }, []);

  const getTodayTransactions = useCallback(() => {
    return transactions;
  }, [transactions]);

  const getDailySummary = useCallback(() => {
    // Solo contar transacciones activas para el resumen
    const activeTx = transactions.filter(t => t.estado !== 'anulado');
    const totalEfectivo = activeTx
      .filter(t => t.paymentMethod === 'efectivo')
      .reduce((sum, t) => sum + t.total, 0);
    const totalMercadoPago = activeTx
      .filter(t => t.paymentMethod === 'mercado_pago')
      .reduce((sum, t) => sum + t.total, 0);

    return {
      count: activeTx.length,
      totalEfectivo,
      totalMercadoPago,
      total: totalEfectivo + totalMercadoPago,
      transactions: transactions, // Devolver todas para mostrar anuladas
    };
  }, [transactions]);

  return {
    transactions,
    isLoading,
    selectedDate,
    setSelectedDate,
    addTransaction,
    voidTransaction,
    isBarberCashClosed,
    getTodayTransactions,
    getDailySummary,
    refetch: () => loadTransactionsByDate(selectedDate),
  };
}
