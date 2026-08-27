import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Sucursal } from '@/contexts/SucursalContext';

export interface ProximaCuota {
  monto: number;
  fecha: string; // yyyy-MM-dd
}

/**
 * Saldo de deuda pendiente para la mini-card "Deuda pendiente" de Vistazo rápido. Consulta
 * directa desde el frontend (no función SQL): `deudas` es una tabla chica (bajo volumen por
 * organización) y esto es un valor "a hoy", sin serie mensual que agregar — no encaja en
 * v_estadisticas_mensuales ni justifica una función fin_*.
 *
 * Independiente del selector de período del panel, igual que usePagoMetodoData.ts.
 *
 * Nota: RLS de `deudas` solo permite owner/manager (ver migración de la tabla) — un usuario
 * general_manager o sucursal_account con acceso a Estadísticas verá $0/sin deuda aunque exista,
 * sin distinción visual de "sin permiso" vs. "sin deuda real". Limitación heredada de la RLS
 * existente, no introducida acá — no se resuelve en este build (candado: no tocar roles/RLS).
 */
export function useDeudaPendienteData(
  organizationId: string | undefined,
  currentSucursal: Sucursal | null,
) {
  const [saldoPendiente, setSaldoPendiente] = useState(0);
  const [proximaCuota, setProximaCuota] = useState<ProximaCuota | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, currentSucursal]);

  const fetchData = async () => {
    if (!organizationId) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from('deudas')
        .select('monto_total, monto_pagado, monto_cuota, fecha_proximo_pago')
        .eq('organization_id', organizationId)
        .eq('estado', 'activa');
      if (currentSucursal) {
        query = query.eq('sucursal_id', currentSucursal.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      const saldo = rows.reduce(
        (sum, d) => sum + (Number(d.monto_total) || 0) - (Number(d.monto_pagado) || 0),
        0,
      );

      const conProximaCuota = rows.filter(
        (d): d is typeof d & { fecha_proximo_pago: string } =>
          !!d.fecha_proximo_pago && d.monto_cuota != null,
      );
      const proxima = conProximaCuota.reduce<typeof conProximaCuota[number] | null>((min, d) => {
        if (!min || d.fecha_proximo_pago < min.fecha_proximo_pago) return d;
        return min;
      }, null);

      setSaldoPendiente(saldo);
      setProximaCuota(proxima ? { monto: Number(proxima.monto_cuota), fecha: proxima.fecha_proximo_pago } : null);
    } catch (error) {
      console.error('Error fetching deuda pendiente:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { saldoPendiente, proximaCuota, isLoading };
}
