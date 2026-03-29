import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export type TipoCosto = 'fijo' | 'variable' | 'semivariable';

export interface Gasto {
  id: number;
  Categoria: string | null;
  Monto: number | null;
  Descripcion: string | null;
  Fecha: string | null;
  organization_id: string | null;
  tipo_costo: TipoCosto | null;
}

export function useGastos() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const fetchGastos = useCallback(async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    try {
      const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      let query = supabase
        .from('Egresos')
        .select('*')
        .eq('organization_id', organization.id)
        .gte('Fecha', `${start}T00:00:00`)
        .lte('Fecha', `${end}T23:59:59`)
        .order('Fecha', { ascending: false });

      if (currentSucursal) {
        query = query.eq('sucursal_id', currentSucursal.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setGastos((data as Gasto[]) || []);
    } catch (error: any) {
      console.error('Error fetching gastos:', error);
      toast.error('Error al cargar gastos');
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id, selectedMonth, currentSucursal]);

  useEffect(() => {
    fetchGastos();
  }, [fetchGastos]);

  const addGasto = async (data: {
    categoria: string;
    monto: number;
    descripcion: string;
    fecha: Date;
    tipoCosto: TipoCosto;
  }) => {
    if (!organization?.id) {
      toast.error('No se encontró la organización');
      return false;
    }

    try {
      const { error } = await supabase.from('Egresos').insert({
        Categoria: data.categoria,
        Monto: data.monto,
        Descripcion: data.descripcion || null,
        Fecha: data.fecha.toISOString(),
        organization_id: organization.id,
        sucursal_id: currentSucursal?.id || null,
        tipo_costo: data.tipoCosto,
      });

      if (error) throw error;
      toast.success('Gasto registrado');
      await fetchGastos();
      return true;
    } catch (error: any) {
      console.error('Error adding gasto:', error);
      toast.error('Error al registrar gasto');
      return false;
    }
  };

  const deleteGasto = async (id: number) => {
    try {
      const { error } = await supabase.from('Egresos').delete().eq('id', id);
      if (error) throw error;
      toast.success('Gasto eliminado');
      await fetchGastos();
    } catch (error: any) {
      console.error('Error deleting gasto:', error);
      toast.error('Error al eliminar gasto');
    }
  };

  const totalPeriodo = gastos.reduce((sum, g) => sum + (g.Monto || 0), 0);

  return {
    gastos,
    isLoading,
    selectedMonth,
    setSelectedMonth,
    addGasto,
    deleteGasto,
    totalPeriodo,
    refetch: fetchGastos,
  };
}
