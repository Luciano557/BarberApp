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
  sucursal_id?: string | null;
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
  const { currentSucursal, isAllMode } = useSucursal();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Cargar ventas de una fecha específica desde Supabase
  const loadTransactionsByDate = useCallback(async (date: Date) => {
    setIsLoading(true);
    
    // Usar funciones de fecha consistentes con timezone de la organización
    const tz = organization?.timezone || null;
    const startStr = getStartOfDayLocal(date, tz);
    const endStr = getEndOfDayLocal(date, tz);

    let query = supabase
      .from('venta')
      .select('*')
      .gte('fecha_hora', startStr)
      .lte('fecha_hora', endStr)
      .order('fecha_hora', { ascending: false });

    // Filter by sucursal if not in "all" mode
    if (currentSucursal) {
      query = query.eq('sucursal_id', currentSucursal.id);
    }

    const { data: ventas, error } = await query;

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
    const [extrasRes, pagosRes] = await Promise.all([
      supabase.from('venta_extra').select('*').in('venta_id', ventaIds),
      supabase.from('venta_pagos').select('*').in('venta_id', ventaIds).order('orden', { ascending: true }),
    ]);
    const ventaExtras = extrasRes.data;
    const ventaPagos = pagosRes.data;

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

    const pagosMap = new Map<string, { method: 'efectivo' | 'mercado_pago'; amount: number }[]>();
    ventaPagos?.forEach((p: any) => {
      const list = pagosMap.get(p.venta_id) || [];
      list.push({
        method: p.metodo_pago as 'efectivo' | 'mercado_pago',
        amount: Number(p.monto),
      });
      pagosMap.set(p.venta_id, list);
    });

    const txs: Transaction[] = ventas.map(v => {
      // Source of truth: venta_pagos rows; fallback for legacy ventas: synthesize 1 entry
      const pagos = pagosMap.get(v.id);
      const payments = pagos && pagos.length > 0
        ? pagos
        : [{
            method: v.metodo_pago as 'efectivo' | 'mercado_pago',
            amount: Number(v.total_final),
          }];
      return {
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
        payments,
        subtotal: Number(v.precio_servicio) + (extrasMap.get(v.id) || []).reduce((s, e) => s + e.price, 0),
        total: Number(v.total_final),
        createdAt: new Date(v.fecha_hora),
        estado: (v as any).estado || 'activo',
        anuladoAt: (v as any).anulado_at ? new Date((v as any).anulado_at) : undefined,
        anuladoPor: (v as any).anulado_por || undefined,
        anuladoPorId: (v as any).anulado_por_id || undefined,
      };
    });

    setTransactions(txs);
    setIsLoading(false);
  }, [currentSucursal, organization?.timezone]);

  useEffect(() => {
    loadTransactionsByDate(selectedDate);
  }, [selectedDate, loadTransactionsByDate, currentSucursal]);

  const addTransaction = useCallback(async (
    transaction: Omit<Transaction, 'id' | 'createdAt'>
  ) => {
    if (!organization) {
      toast.error('No se encontró la organización');
      return null;
    }

    if (!currentSucursal) {
      toast.error('Seleccioná una sucursal antes de registrar un cobro');
      return null;
    }

    if (!navigator.onLine) {
      toast.error('No hay conexión a Internet. Conectate y volvé a intentar.');
      return null;
    }

    // Normalize names to avoid spacing issues
    const normalizedBarberName = transaction.barberName.replace(/\s+/g, ' ').trim();
    const normalizedServiceName = transaction.serviceName.replace(/\s+/g, ' ').trim();

    // Determine payments array (always at least 1)
    const payments = transaction.payments && transaction.payments.length > 0
      ? transaction.payments
      : [{ method: transaction.paymentMethod, amount: transaction.total }];

    // Legacy field: use the method with the largest amount as primary
    const primaryMethod = [...payments].sort((a, b) => b.amount - a.amount)[0].method;

    // Insertar venta principal
    const ventaData: VentaInsert = {
      barbero_id: transaction.barberId,
      barbero_nombre: normalizedBarberName,
      servicio_id: transaction.serviceId,
      servicio_nombre: normalizedServiceName,
      precio_servicio: transaction.servicePrice,
      descuento_pct: transaction.discount,
      metodo_pago: primaryMethod,
      total_final: transaction.total,
      organization_id: organization.id,
      sucursal_id: currentSucursal.id,
    };

    const { data: venta, error: ventaError } = await supabase
      .from('venta')
      .insert(ventaData)
      .select()
      .single();

    if (ventaError) {
      console.error('Error inserting venta:', ventaError);
      return null;
    }

    // Insertar pagos (siempre, incluso para método único)
    const pagosData = payments.map((p, idx) => ({
      venta_id: venta.id,
      organization_id: organization.id,
      sucursal_id: currentSucursal.id,
      metodo_pago: p.method,
      monto: p.amount,
      orden: idx + 1,
    }));

    const { error: pagosError } = await supabase
      .from('venta_pagos')
      .insert(pagosData);

    if (pagosError) {
      console.error('Error inserting venta_pagos:', pagosError);
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
      payments,
      paymentMethod: primaryMethod,
      id: venta.id,
      createdAt: new Date(venta.fecha_hora),
    };

    setTransactions(prev => [newTransaction, ...prev]);
    return newTransaction;
  }, [organization, currentSucursal]);

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
    const tz = organization?.timezone || null;
    const startStr = getStartOfDayLocal(date, tz);
    const endStr = getEndOfDayLocal(date, tz);
    
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
  }, [organization?.timezone]);

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
