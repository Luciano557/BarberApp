import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import type { Sucursal } from '@/contexts/SucursalContext';
import {
  computeHorasDisponibles, hasCoberturaIncompleta, OcupacionBloqueo, OcupacionHorario,
} from './ocupacionHelpers';

export interface OcupacionMonthData {
  month: string; // 'yyyy-MM'
  horasDisponibles: number; // mes completo (o transcurrido a la fecha, si es el mes en curso)
  /** Solo se completa para el mes anterior al actual: primeros N días, mismo recorte que "parcial*" de useEstadisticasData. */
  horasDisponiblesParciales?: number;
}

const DEFAULT_DURACION_MIN = 30;

/**
 * Datos para la Tasa de Ocupación real: horas-silla disponibles del local entero
 * (horarios_trabajo de los barberos activos, netos de bloqueos_agenda) y la duración
 * promedio de servicios activos (para estimar horas vendidas a partir del conteo de
 * `ingresos.cantidad_de_servicios`, que no guarda qué servicio puntual fue cada uno).
 */
export function useOcupacionData(
  organizationId: string | undefined,
  currentSucursal: Sucursal | null,
  periodoMeses: string,
) {
  const [ocupacionPorMes, setOcupacionPorMes] = useState<OcupacionMonthData[]>([]);
  const [avgDuracionMin, setAvgDuracionMin] = useState(DEFAULT_DURACION_MIN);
  const [coberturaIncompleta, setCoberturaIncompleta] = useState(false);
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
      const endDate = endOfMonth(new Date());
      const startDate = startOfMonth(subMonths(new Date(), meses - 1));

      let barberosQuery = supabase
        .from('barberos')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('activo', true);
      if (currentSucursal) barberosQuery = barberosQuery.eq('sucursal_id', currentSucursal.id);

      let horariosQuery = supabase
        .from('horarios_trabajo')
        .select('dia_semana, hora_inicio, hora_fin, barbero_id')
        .eq('organization_id', organizationId)
        .eq('activo', true);
      if (currentSucursal) horariosQuery = horariosQuery.eq('sucursal_id', currentSucursal.id);

      let bloqueosQuery = supabase
        .from('bloqueos_agenda')
        .select('fecha_inicio, fecha_fin, hora_inicio, hora_fin, todo_el_dia, barbero_id')
        .eq('organization_id', organizationId)
        .lte('fecha_inicio', format(endDate, 'yyyy-MM-dd'))
        .gte('fecha_fin', format(startDate, 'yyyy-MM-dd'));
      if (currentSucursal) bloqueosQuery = bloqueosQuery.eq('sucursal_id', currentSucursal.id);

      const serviciosQuery = supabase
        .from('servicios')
        .select('duracion_min')
        .eq('organization_id', organizationId)
        .eq('activo', true)
        .eq('eliminado', false);

      const [barberosRes, horariosRes, bloqueosRes, serviciosRes] = await Promise.all([
        barberosQuery, horariosQuery, bloqueosQuery, serviciosQuery,
      ]);

      if (barberosRes.error) throw barberosRes.error;
      if (horariosRes.error) throw horariosRes.error;
      if (bloqueosRes.error) throw bloqueosRes.error;
      if (serviciosRes.error) throw serviciosRes.error;

      const barberoIds = (barberosRes.data || []).map((b) => b.id);
      const horarios = (horariosRes.data || []) as OcupacionHorario[];
      const bloqueos = (bloqueosRes.data || []) as OcupacionBloqueo[];
      const duraciones = (serviciosRes.data || [])
        .map((s) => s.duracion_min)
        .filter((d): d is number => typeof d === 'number' && d > 0);
      const avgDuracion = duraciones.length > 0
        ? duraciones.reduce((a, b) => a + b, 0) / duraciones.length
        : DEFAULT_DURACION_MIN;

      setAvgDuracionMin(avgDuracion);
      setCoberturaIncompleta(barberoIds.length > 0 && hasCoberturaIncompleta(horarios, barberoIds));

      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      const today = new Date();
      const diaActual = today.getDate();
      const currentMonthStr = format(today, 'yyyy-MM');

      const ocupacion: OcupacionMonthData[] = months.map((monthDate, idx) => {
        const monthStr = format(monthDate, 'yyyy-MM');
        const monthStartD = startOfMonth(monthDate);
        const monthEndD = endOfMonth(monthDate);
        const isCurrentMonth = monthStr === currentMonthStr;
        // Mismo recorte que getWorkDaysUpTo para el mes en curso: solo días transcurridos.
        const effectiveEnd = isCurrentMonth ? today : monthEndD;
        const horasDisponibles = computeHorasDisponibles(horarios, bloqueos, barberoIds, monthStartD, effectiveEnd);

        const nextMonthStr = idx < months.length - 1 ? format(months[idx + 1], 'yyyy-MM') : null;
        const needsPartial = nextMonthStr === currentMonthStr;
        let horasDisponiblesParciales: number | undefined;
        if (needsPartial) {
          const lastPartialDay = Math.min(diaActual, monthEndD.getDate());
          const partialEnd = new Date(monthStartD.getFullYear(), monthStartD.getMonth(), lastPartialDay);
          horasDisponiblesParciales = computeHorasDisponibles(horarios, bloqueos, barberoIds, monthStartD, partialEnd);
        }

        return { month: monthStr, horasDisponibles, horasDisponiblesParciales };
      });

      setOcupacionPorMes(ocupacion);
    } catch (error) {
      console.error('Error fetching ocupación:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { ocupacionPorMes, avgDuracionMin, coberturaIncompleta, isLoading };
}
