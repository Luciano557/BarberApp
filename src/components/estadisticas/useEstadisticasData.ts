import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Sucursal } from '@/contexts/SucursalContext';
import { alcanzoLimiteFilas } from './rowLimit';

export interface MonthlyData {
  month: string;
  monthLabel: string;
  facturacion: number;
  servicios: number;
  efectivo: number;
  mp: number;
  costosFijos: number;
  costosVariables: number;
  costosSemivariables: number;
  totalEgresos: number;
  barberosDelMes: number;
  recargosTotal: number;
  perdida: number;
  sueldoTotal: number;
  comisionProductos: number;
  // Métricas financieras ya resueltas en la base (funciones fin_*). El frontend no las recalcula.
  ticketPromedio: number;
  rentabilidad: number;
  costoFijoPorServicio: number;
  costoVariablePorServicio: number;
  gananciaPorServicio: number;
  puntoEquilibrio: number;
  costoLaboralPct: number;
  // Partial sums for same-day comparison (first N days only)
  parcialFacturacion?: number;
  parcialServicios?: number;
  parcialEfectivo?: number;
  parcialMp?: number;
  parcialCostosFijos?: number;
  parcialRecargosTotal?: number;
  parcialPerdida?: number;
}

interface IngresoRawRow {
  created_at: string;
  cantidad_de_servicios: number;
  dia: string | null;
}

/**
 * Agregación mensual de Estadísticas.
 *
 * Los totales mensuales y todas las métricas financieras vienen resueltos de
 * `estadisticas_mensuales(...)`, que se apoya en la vista `v_estadisticas_mensuales`
 * (corte de mes con AT TIME ZONE de la sucursal) y en las funciones `fin_*`. Acá no se
 * suma ni se recalcula ninguna fórmula financiera: solo se le da forma a los datos.
 *
 * Se sigue leyendo `ingresos` en crudo únicamente para el gráfico "ventas por día de semana"
 * (columna `dia`), con la salvaguarda de truncado activa.
 */
export function useEstadisticasData(
  organizationId: string | undefined,
  currentSucursal: Sucursal | null,
  periodoMeses: string,
) {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ingresosRaw, setIngresosRaw] = useState<IngresoRawRow[]>([]);
  const [datosIncompletos, setDatosIncompletos] = useState(false);

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

      const mensualesRpc = supabase.rpc('estadisticas_mensuales', {
        _organization_id: organizationId,
        _sucursal_id: currentSucursal?.id ?? undefined,
        _meses: meses,
      });

      // Solo para "ventas por día de semana" (columna `dia` de ingresos, fuera de alcance).
      let ingresosQuery = supabase
        .from('ingresos')
        .select('created_at, cantidad_de_servicios, dia')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .neq('estado', 'eliminado');
      if (currentSucursal) {
        ingresosQuery = ingresosQuery.eq('sucursal_id', currentSucursal.id);
      }

      const [mensualesRes, ingresosRes] = await Promise.all([
        mensualesRpc, ingresosQuery,
      ]);

      if (mensualesRes.error) throw mensualesRes.error;
      if (ingresosRes.error) throw ingresosRes.error;

      // Salvaguarda de truncado: los totales ya no dependen de filas crudas; la única lectura
      // cruda que queda es la de `ingresos` para el gráfico por día de semana.
      setDatosIncompletos(alcanzoLimiteFilas(ingresosRes.data));

      setIngresosRaw((ingresosRes.data || []).map((i) => ({
        created_at: i.created_at,
        cantidad_de_servicios: Number(i.cantidad_de_servicios) || 0,
        dia: i.dia || null,
      })));

      const rows = mensualesRes.data || [];
      const currentMonthStr = format(new Date(), 'yyyy-MM');
      const diaActual = new Date().getDate();

      const monthlyStats: MonthlyData[] = rows.map((r, idx) => {
        const monthDate = parseISO(`${String(r.mes).slice(0, 10)}T00:00:00`);
        const monthStr = format(monthDate, 'yyyy-MM');

        // Solo el mes inmediatamente anterior al mes en curso necesita los parciales
        // "mismos primeros N días" para la comparación en igualdad de condiciones.
        const nextMonthStr = idx < rows.length - 1 ? String(rows[idx + 1].mes).slice(0, 7) : null;
        const needsPartial = nextMonthStr === currentMonthStr;

        return {
          month: monthStr,
          monthLabel: format(monthDate, 'MMM yy', { locale: es }),
          facturacion: Number(r.facturacion) || 0,
          servicios: Number(r.servicios) || 0,
          efectivo: Number(r.efectivo) || 0,
          mp: Number(r.mp) || 0,
          costosFijos: Number(r.costos_fijos) || 0,
          costosVariables: Number(r.costos_variables) || 0,
          costosSemivariables: Number(r.costos_semivariables) || 0,
          totalEgresos: Number(r.total_egresos) || 0,
          barberosDelMes: Number(r.barberos_del_mes) || 0,
          recargosTotal: Number(r.recargos_total) || 0,
          perdida: Number(r.perdida) || 0,
          sueldoTotal: Number(r.sueldo_total) || 0,
          comisionProductos: Number(r.comision_productos) || 0,
          ticketPromedio: Number(r.ticket_promedio) || 0,
          rentabilidad: Number(r.rentabilidad_pct) || 0,
          costoFijoPorServicio: Number(r.costo_fijo_por_servicio) || 0,
          costoVariablePorServicio: Number(r.costo_variable_por_servicio) || 0,
          gananciaPorServicio: Number(r.ganancia_por_servicio) || 0,
          puntoEquilibrio: Number(r.punto_equilibrio) || 0,
          costoLaboralPct: Number(r.costo_laboral_pct) || 0,
          parcialFacturacion: needsPartial ? Number(r.parcial_facturacion) || 0 : undefined,
          parcialServicios: needsPartial ? Number(r.parcial_servicios) || 0 : undefined,
          parcialEfectivo: needsPartial ? Number(r.parcial_efectivo) || 0 : undefined,
          parcialMp: needsPartial ? Number(r.parcial_mp) || 0 : undefined,
          parcialCostosFijos: needsPartial ? Number(r.parcial_costos_fijos) || 0 : undefined,
          parcialRecargosTotal: needsPartial ? Number(r.parcial_recargos_total) || 0 : undefined,
          parcialPerdida: needsPartial ? Number(r.parcial_perdida) || 0 : undefined,
        };
      });

      setMonthlyData(monthlyStats);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { monthlyData, isLoading, ingresosRaw, datosIncompletos };
}
