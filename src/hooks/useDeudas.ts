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

export function useDeudas() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDeudas = useCallback(async () => {
    if (!organization?.id) return;
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

      const { data, error } = await query;

      if (error) throw error;
      setDeudas((data as Deuda[]) || []);
    } catch (error: any) {
      console.error('Error fetching deudas:', error);
      toast.error('Error al cargar deudas');
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id]);

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
    if (!organization?.id) {
      toast.error('No se encontró la organización');
      return false;
    }

    try {
      const { error } = await supabase.from('deudas').insert({
        organization_id: organization.id,
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

  const registrarPago = async (deuda: Deuda) => {
    const nuevasCuotasPagadas = deuda.cuotas_pagadas + 1;
    const nuevoMontoPagado = deuda.monto_pagado + (deuda.monto_cuota || 0);
    const pagada =
      (deuda.cuotas_totales && nuevasCuotasPagadas >= deuda.cuotas_totales) ||
      nuevoMontoPagado >= deuda.monto_total;

    try {
      const { error } = await supabase
        .from('deudas')
        .update({
          cuotas_pagadas: nuevasCuotasPagadas,
          monto_pagado: Math.min(nuevoMontoPagado, deuda.monto_total),
          estado: pagada ? 'pagada' : 'activa',
        })
        .eq('id', deuda.id);

      if (error) throw error;
      toast.success(pagada ? '¡Deuda pagada en su totalidad!' : 'Pago registrado');
      await fetchDeudas();
    } catch (error: any) {
      console.error('Error registrando pago:', error);
      toast.error('Error al registrar pago');
    }
  };

  const deleteDeuda = async (id: string) => {
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

  return {
    deudas,
    isLoading,
    addDeuda,
    registrarPago,
    deleteDeuda,
    refetch: fetchDeudas,
  };
}
