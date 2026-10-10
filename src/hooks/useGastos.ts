import { useFinanceDemo } from '@/contexts/FinanceDemoContext';
import { useOperationalAccess, type OperationalReadOptions } from '@/hooks/useOperationalAccess';
import { runFinanceWrite } from '@/lib/financeDemoRuntime';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  inversion_id: string | null;
  gasto_recurrente_id?: string | null;
  pago_deuda_id?: string | null;
  pago_sueldo_id?: string | null;
}

export function useGastos(options: OperationalReadOptions = {}) {
  const demo = useFinanceDemo();
  const enabled = options.enabled !== false && !demo.active;
  const access = useOperationalAccess(enabled);
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const fetchGastos = useCallback(async () => {
    if (!organization?.id || !enabled || !access.allowed()) return;
    const request = access.start();
    setIsLoading(true);
    try {
      const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      let query = supabase
        .from('Egresos')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('estado', 'activo')
        .gte('Fecha', `${start}T00:00:00`)
        .lte('Fecha', `${end}T23:59:59`)
        .order('Fecha', { ascending: false });

      if (currentSucursal) {
        query = query.eq('sucursal_id', currentSucursal.id);
      }

      const { data, error } = await query.abortSignal(request.signal);
      if (!request.current()) return;

      if (error) throw error;
      setGastos((data as Gasto[]) || []);
    } catch (error: any) {
      if (!request.current()) return;
      console.error('Error fetching gastos:', error);
      toast.error('Error al cargar gastos');
    } finally {
      if (request.current()) setIsLoading(false);
      request.finish();
    }
  }, [enabled, access, organization?.id, selectedMonth, currentSucursal]);


  const hasSynced = useRef<string>('');
  const syncRecurrentesRef = useRef<(() => Promise<boolean>) | null>(null);

  // Allow injecting the recurrentes sync from outside
  const setSyncRecurrentes = useCallback((fn: () => Promise<boolean>) => {
    syncRecurrentesRef.current = fn;
  }, []);

  useEffect(() => {
    if (!enabled || !access.allowed()) return;
    const key = `${organization?.id}-${format(selectedMonth, 'yyyy-MM')}-${currentSucursal?.id || 'all'}`;
    if (hasSynced.current === key) return;

    const run = async () => {
      // Sync recurrentes first (generates egresos up to today)
      if (syncRecurrentesRef.current) {
        await syncRecurrentesRef.current();
      }
      if (!access.allowed()) return;
      await fetchGastos();
      hasSynced.current = key;
    };
    run();
  }, [enabled, access.allowed, fetchGastos]);

  const addGasto = async (data: {
    categoria: string;
    monto: number;
    descripcion: string;
    fecha: Date;
    tipoCosto: TipoCosto;
  }) => {
    if (!access.allowed()) return;
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

  const anularGasto = async (
    id: number,
    motivo: string,
    audit?: { validatedByUserId?: string | null }
  ) => {
    if (!access.allowed()) return;
    const motivoLimpio = (motivo || '').trim().slice(0, 240);
    if (!motivoLimpio) {
      toast.error('Indicá un motivo de anulación');
      return false;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('Egresos')
        .update({
          estado: 'anulado',
          anulado_at: new Date().toISOString(),
          anulado_por: user?.id ?? null,
          anulado_por_pin_user_id: audit?.validatedByUserId ?? null,
          anulado_motivo: motivoLimpio,
        })
        .eq('id', id);
      if (error) throw error;
      toast.success('Gasto anulado');
      await fetchGastos();
      return true;
    } catch (error: any) {
      console.error('Error anulando gasto:', error);
      toast.error('Error al anular gasto');
      return false;
    }
  };

  const totalPeriodo = gastos.reduce((sum, g) => sum + (g.Monto || 0), 0);

  return {
    gastos,
    isLoading,
    selectedMonth,
    setSelectedMonth,
    addGasto: (...args: Parameters<typeof addGasto>) => runFinanceWrite(() => addGasto(...args)),
    anularGasto: (...args: Parameters<typeof anularGasto>) => runFinanceWrite(() => anularGasto(...args)),
    totalPeriodo,
    refetch: fetchGastos,
    setSyncRecurrentes,
    ...(demo.active ? { gastos: demo.data.gastos.filter(row => row.Fecha?.startsWith(format(selectedMonth, 'yyyy-MM'))), isLoading: false, totalPeriodo: demo.data.gastos.filter(row => row.Fecha?.startsWith(format(selectedMonth, 'yyyy-MM'))).reduce((sum, row) => sum + (row.Monto ?? 0), 0) } : {}),
  };
}
