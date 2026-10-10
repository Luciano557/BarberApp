import { useFinanceDemo } from '@/contexts/FinanceDemoContext';
import { useOperationalAccess, type OperationalReadOptions } from '@/hooks/useOperationalAccess';
import { runFinanceWrite } from '@/lib/financeDemoRuntime';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { toast } from 'sonner';

export interface Deuda {
  id: string;
  organization_id: string;
  inversion_id: string | null;
  acreedor: string;
  monto_total: number;
  monto_pagado: number;
  cuotas_totales: number | null;
  cuotas_pagadas: number;
  monto_cuota: number | null;
  fecha_inicio: string;
  fecha_proximo_pago: string | null;
  descripcion: string | null;
  estado: string;
  created_at: string;
}

export interface PagoDeuda {
  id: string;
  deuda_id: string;
  monto: number;
  fecha_pago: string;
  numero_cuota: number | null;
  observacion: string | null;
  created_at: string;
}

export function useDeudas(options: OperationalReadOptions = {}) {
  const demo = useFinanceDemo();
  const enabled = options.enabled !== false && !demo.active;
  const access = useOperationalAccess(enabled);
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDeudas = useCallback(async () => {
    if (!organization?.id || !enabled || !access.allowed()) return;
    const request = access.start();
    setIsLoading(true);
    try {
      let query = supabase
        .from('deudas')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (currentSucursal) {
        query = query.eq('sucursal_id', currentSucursal.id);
      }

      const { data, error } = await query.abortSignal(request.signal);
      if (!request.current()) return;

      if (error) throw error;
      setDeudas((data as Deuda[]) || []);
    } catch (error: any) {
      if (!request.current()) return;
      console.error('Error fetching deudas:', error);
      toast.error('Error al cargar deudas');
    } finally {
      if (request.current()) setIsLoading(false);
      request.finish();
    }
  }, [enabled, access, organization?.id, currentSucursal]);

  useEffect(() => {
    fetchDeudas();
  }, [fetchDeudas]);

  const addDeuda = async (data: {
    acreedor: string;
    monto_total: number;
    cuotas_totales?: number;
    monto_cuota?: number;
    fecha_inicio: Date;
    fecha_proximo_pago?: Date;
    descripcion?: string;
    inversion_id?: string;
  }) => {
    if (!access.allowed()) return;
    if (!organization?.id) {
      toast.error('No se encontró la organización');
      return false;
    }

    try {
      const { error } = await supabase.from('deudas').insert({
        organization_id: organization.id,
        sucursal_id: currentSucursal?.id || null,
        acreedor: data.acreedor,
        monto_total: data.monto_total,
        cuotas_totales: data.cuotas_totales || null,
        monto_cuota: data.monto_cuota || null,
        fecha_inicio: data.fecha_inicio.toISOString().split('T')[0],
        fecha_proximo_pago: data.fecha_proximo_pago
          ? data.fecha_proximo_pago.toISOString().split('T')[0]
          : null,
        descripcion: data.descripcion || null,
        inversion_id: data.inversion_id || null,
      });

      if (error) throw error;
      toast.success('Deuda registrada');
      await fetchDeudas();
      return true;
    } catch (error: any) {
      console.error('Error adding deuda:', error);
      toast.error('Error al registrar deuda');
      return false;
    }
  };

  const registrarPago = async (
    deuda: Deuda,
    montoPagado: number,
    fechaPago: string,
    observacion?: string,
  ) => {
    if (!access.allowed()) return;
    try {
      const saldoPendiente = Number(deuda.monto_total) - Number(deuda.monto_pagado);
      if (!isFinite(montoPagado) || montoPagado <= 0) {
        toast.error('El monto debe ser mayor a 0');
        return false;
      }
      if (montoPagado > saldoPendiente + 0.009) {
        toast.error('El monto no puede superar el saldo pendiente');
        return false;
      }

      const tieneCuotas = !!deuda.cuotas_totales && deuda.cuotas_totales > 0;
      const numeroCuota = tieneCuotas ? deuda.cuotas_pagadas + 1 : null;
      const sucursalId =
        (deuda as any).sucursal_id ?? currentSucursal?.id ?? null;

      // 1. Insertar el pago en pagos_deudas
      const { data: pagoInsertado, error: insertError } = await supabase
        .from('pagos_deudas')
        .insert({
          organization_id: deuda.organization_id,
          sucursal_id: sucursalId,
          deuda_id: deuda.id,
          monto: montoPagado,
          fecha_pago: fechaPago,
          numero_cuota: numeroCuota,
          observacion: observacion?.trim() ? observacion.trim() : null,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      const pagoDeudaId = pagoInsertado.id as string;

      // 2. Crear el egreso automático. Rollback del pago si falla.
      const tipoCosto: 'fijo' | 'variable' = tieneCuotas ? 'fijo' : 'variable';
      const refTexto =
        (deuda.descripcion?.trim() || deuda.acreedor || 'Deuda').trim();
      const descripcionEgreso = tieneCuotas
        ? `Cuota ${numeroCuota}/${deuda.cuotas_totales} — ${refTexto}`
        : `Pago — ${refTexto}`;

      const { data: egresoInsertado, error: egresoError } = await supabase
        .from('Egresos')
        .insert({
          Fecha: `${fechaPago}T00:00:00`,
          Categoria: 'Pagos de deudas',
          Monto: montoPagado,
          Descripcion: descripcionEgreso,
          tipo_costo: tipoCosto,
          pago_deuda_id: pagoDeudaId,
          organization_id: deuda.organization_id,
          sucursal_id: sucursalId,
          estado: 'activo',
        })
        .select('id')
        .single();

      if (egresoError || !egresoInsertado) {
        // Rollback: borrar el pago para no dejarlo huérfano
        await supabase.from('pagos_deudas').delete().eq('id', pagoDeudaId);
        throw egresoError ?? new Error('No se pudo crear el egreso');
      }

      // 3. Vincular bidireccionalmente egreso_id en pagos_deudas (best-effort)
      await supabase
        .from('pagos_deudas')
        .update({ egreso_id: egresoInsertado.id })
        .eq('id', pagoDeudaId);

      // 4. Actualizar acumulados / estado en deudas
      const nuevoMontoPagado = Number(deuda.monto_pagado) + montoPagado;
      const nuevasCuotasPagadas = tieneCuotas
        ? deuda.cuotas_pagadas + 1
        : deuda.cuotas_pagadas;
      const nuevoEstado =
        nuevoMontoPagado >= Number(deuda.monto_total) - 0.009 ? 'pagada' : 'activa';

      const { error: updateError } = await supabase
        .from('deudas')
        .update({
          monto_pagado: nuevoMontoPagado,
          cuotas_pagadas: nuevasCuotasPagadas,
          estado: nuevoEstado,
        })
        .eq('id', deuda.id);

      if (updateError) throw updateError;

      toast.success(nuevoEstado === 'pagada' ? 'Deuda saldada' : 'Pago registrado');
      await fetchDeudas();
      return true;
    } catch (error: any) {
      console.error('Error registrando pago:', error);
      toast.error('Error al registrar pago');
      return false;
    }
  };

  const deleteDeuda = async (id: string) => {
    if (!access.allowed()) return;
    try {
      const { error } = await supabase.from('deudas').delete().eq('id', id);
      if (error) throw error;
      toast.success('Deuda eliminada');
      await fetchDeudas();
    } catch (error: any) {
      console.error('Error deleting deuda:', error);
      toast.error('Error al eliminar deuda');
    }
  };

  const fetchPagosDeuda = useCallback(
    async (deudaId: string): Promise<PagoDeuda[]> => {
      if (!organization?.id || !access.allowed()) return [];
      const request = access.start();
      try {
        const { data, error } = await supabase
          .from('pagos_deudas')
          .select('id, deuda_id, monto, fecha_pago, numero_cuota, observacion, created_at')
          .eq('organization_id', organization.id)
          .eq('deuda_id', deudaId)
          .order('fecha_pago', { ascending: true }).abortSignal(request.signal);
        if (!request.current()) return [];
        if (error) throw error;
        return (data as PagoDeuda[]) || [];
      } catch (error: any) {
        if (!request.current()) return [];
        console.error('Error fetching pagos de deuda:', error);
        toast.error('Error al cargar el historial de pagos');
        return [];
      } finally { request.finish(); }
    },
    [organization?.id, access],
  );

  return {
    deudas,
    isLoading,
    addDeuda: (...args: Parameters<typeof addDeuda>) => runFinanceWrite(() => addDeuda(...args)),
    registrarPago: (...args: Parameters<typeof registrarPago>) => runFinanceWrite(() => registrarPago(...args)),
    deleteDeuda: (...args: Parameters<typeof deleteDeuda>) => runFinanceWrite(() => deleteDeuda(...args)),
    fetchPagosDeuda,
    refetch: fetchDeudas,
    ...(demo.active ? { deudas: demo.data.deudas, isLoading: false, fetchPagosDeuda: async (deudaId: string) => demo.data.debtPayments.filter(row => row.deuda_id === deudaId) } : {}),
  };
}
