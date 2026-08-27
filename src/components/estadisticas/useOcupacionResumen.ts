import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Sucursal } from '@/contexts/SucursalContext';

export interface OcupacionMonthData {
  month: string; // 'yyyy-MM'
  tasaOcupacion: number | null;
  /** Solo se completa para el mes anterior al actual: primeros N días, mismo recorte que "parcial*" de useEstadisticasData. */
  tasaOcupacionParcial: number | null;
  coberturaIncompleta: boolean;
  duracionPromedioMin: number | null;
}

/**
 * Datos para la Tasa de Ocupación de la Sección Resumen. Todo el cálculo (duración ponderada
 * por volumen real de ventas, horas vendidas, horas disponibles del horario general, tasa
 * final) se resuelve en `estadisticas_ocupacion_mensual` — este hook solo llama a la RPC y
 * expone el resultado, sin ninguna aritmética en JS.
 *
 * `tasaOcupacion`/`tasaOcupacionParcial` llegan en `null` (nunca 0 forzado) cuando falta el
 * horario general de la sucursal, no hay barberos activos con rol 'barber', o no hay ventas
 * con servicio matcheado ese mes — el frontend decide qué mostrar según ese `null`, no lo
 * calcula ni lo reinterpreta.
 */
export function useOcupacionResumen(
  organizationId: string | undefined,
  currentSucursal: Sucursal | null,
  periodoMeses: string,
) {
  const [ocupacionPorMes, setOcupacionPorMes] = useState<OcupacionMonthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, periodoMeses, currentSucursal]);

  const fetchData = async () => {
    if (!organizationId) return;
    setIsLoading(true);

    try {
      const meses = parseInt(periodoMeses);
      const { data, error } = await supabase.rpc('estadisticas_ocupacion_mensual', {
        _organization_id: organizationId,
        _sucursal_id: currentSucursal?.id ?? undefined,
        _meses: meses,
      });
      if (error) throw error;

      const rows = data || [];
      setOcupacionPorMes(rows.map((r) => ({
        month: String(r.mes).slice(0, 7),
        tasaOcupacion: r.tasa_ocupacion == null ? null : Number(r.tasa_ocupacion),
        tasaOcupacionParcial: r.tasa_ocupacion_parcial == null ? null : Number(r.tasa_ocupacion_parcial),
        coberturaIncompleta: !!r.cobertura_incompleta,
        duracionPromedioMin: r.duracion_promedio_ponderada == null ? null : Number(r.duracion_promedio_ponderada),
      })));
    } catch (error) {
      console.error('Error fetching ocupación (resumen):', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { ocupacionPorMes, isLoading };
}
