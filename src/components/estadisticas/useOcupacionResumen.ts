import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import type { Sucursal } from '@/contexts/SucursalContext';

export interface OcupacionMonthData {
  month: string; // 'yyyy-MM'
  horasDisponibles: number; // mes completo (o transcurrido a la fecha, si es el mes en curso)
  /** Solo se completa para el mes anterior al actual: primeros N días, mismo recorte que "parcial*" de useEstadisticasData. */
  horasDisponiblesParciales?: number;
}

const DEFAULT_DURACION_MIN = 30;

/** ISO day-of-week matching horarios_trabajo.dia_semana (1=Lun..7=Dom). */
function isoDayOfWeek(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Datos para la Tasa de Ocupación de la Sección Resumen: fórmula plana confirmada por el
 * dueño del negocio —
 *
 *   Ocupación = horas vendidas ÷ (barberos activos con rol barbero × horas que abre el
 *   local ese día) × 100
 *
 * A diferencia de `useOcupacionData.ts` (que queda disponible para Agenda, ver nota en
 * AUDITORIA_DATOS_ESTADISTICAS.md), este cálculo:
 * - NO mira horario individual de barbero, solo el horario GENERAL de la sucursal
 *   (`horarios_trabajo.barbero_id IS NULL`).
 * - NO resta bloqueos/vacaciones puntuales — la capacidad instalada es la del equipo activo
 *   completo, sin importar quién trabajó cada día particular.
 * - Usa la cantidad ACTUAL de barberos activos con rol 'barber' para todo el rango (no
 *   reconstruye cuántos había cada mes pasado).
 */
export function useOcupacionResumen(
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
        .select('id, roles_equipo')
        .eq('organization_id', organizationId)
        .eq('activo', true);
      if (currentSucursal) barberosQuery = barberosQuery.eq('sucursal_id', currentSucursal.id);

      let horariosQuery = supabase
        .from('horarios_trabajo')
        .select('dia_semana, hora_inicio, hora_fin')
        .eq('organization_id', organizationId)
        .eq('activo', true)
        .is('barbero_id', null);
      if (currentSucursal) horariosQuery = horariosQuery.eq('sucursal_id', currentSucursal.id);

      const serviciosQuery = supabase
        .from('servicios')
        .select('duracion_min')
        .eq('organization_id', organizationId)
        .eq('activo', true)
        .eq('eliminado', false);

      const [barberosRes, horariosRes, serviciosRes] = await Promise.all([
        barberosQuery, horariosQuery, serviciosQuery,
      ]);

      if (barberosRes.error) throw barberosRes.error;
      if (horariosRes.error) throw horariosRes.error;
      if (serviciosRes.error) throw serviciosRes.error;

      // Mismo filtro que el fix de DailySummary.tsx: rol 'barber' dentro de roles_equipo,
      // no el conteo genérico de "barberos activos" (que mezcla encargados, etc.).
      const barberosConRolBarbero = (barberosRes.data || []).filter(
        (b) => Array.isArray(b.roles_equipo) && (b.roles_equipo as string[]).includes('barber'),
      ).length;

      const horariosGenerales = horariosRes.data || [];
      // "El local nunca configuró su horario general": cero filas de horario general
      // cargadas para la sucursal. (No se chequea día por día porque cualquier negocio con
      // un franco semanal legítimo — ej. cerrado los domingos — dispararía el aviso todo el
      // tiempo; ver nota en el reporte de este build.)
      setCoberturaIncompleta(horariosGenerales.length === 0);

      // Horas que abre el local por día de semana ISO (1=Lun..7=Dom), sumando todas las
      // ventanas generales de ese día (soporta turnos partidos).
      const horasPorDiaSemana = Array(8).fill(0);
      horariosGenerales.forEach((h) => {
        const minutos = Math.max(0, timeToMinutes(h.hora_fin) - timeToMinutes(h.hora_inicio));
        horasPorDiaSemana[h.dia_semana] += minutos / 60;
      });

      const duraciones = (serviciosRes.data || []).map((s) => (
        typeof s.duracion_min === 'number' && s.duracion_min > 0 ? s.duracion_min : DEFAULT_DURACION_MIN
      ));
      const avgDuracion = duraciones.length > 0
        ? duraciones.reduce((a, b) => a + b, 0) / duraciones.length
        : DEFAULT_DURACION_MIN;
      setAvgDuracionMin(avgDuracion);

      const sumaHorasOperativas = (rangeStart: Date, rangeEnd: Date): number => {
        if (rangeStart > rangeEnd) return 0;
        let total = 0;
        let cursor = new Date(rangeStart);
        while (cursor <= rangeEnd) {
          total += horasPorDiaSemana[isoDayOfWeek(cursor)] * barberosConRolBarbero;
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        }
        return total;
      };

      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      const today = new Date();
      const diaActual = today.getDate();
      const currentMonthStr = format(today, 'yyyy-MM');

      const ocupacion: OcupacionMonthData[] = months.map((monthDate, idx) => {
        const monthStr = format(monthDate, 'yyyy-MM');
        const monthStartD = startOfMonth(monthDate);
        const monthEndD = endOfMonth(monthDate);
        const isCurrentMonth = monthStr === currentMonthStr;
        // Mismo recorte que el resto del panel para el mes en curso: solo días transcurridos.
        const effectiveEnd = isCurrentMonth ? today : monthEndD;
        const horasDisponibles = sumaHorasOperativas(monthStartD, effectiveEnd);

        const nextMonthStr = idx < months.length - 1 ? format(months[idx + 1], 'yyyy-MM') : null;
        const needsPartial = nextMonthStr === currentMonthStr;
        let horasDisponiblesParciales: number | undefined;
        if (needsPartial) {
          const lastPartialDay = Math.min(diaActual, monthEndD.getDate());
          const partialEnd = new Date(monthStartD.getFullYear(), monthStartD.getMonth(), lastPartialDay);
          horasDisponiblesParciales = sumaHorasOperativas(monthStartD, partialEnd);
        }

        return { month: monthStr, horasDisponibles, horasDisponiblesParciales };
      });

      setOcupacionPorMes(ocupacion);
    } catch (error) {
      console.error('Error fetching ocupación (resumen):', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { ocupacionPorMes, avgDuracionMin, coberturaIncompleta, isLoading };
}
