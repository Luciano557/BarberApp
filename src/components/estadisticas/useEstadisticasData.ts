import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Sucursal } from '@/contexts/SucursalContext';
import { getWorkDaysUpTo } from './dateHelpers';
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
  // Partial sums for same-day comparison (first N days only)
  parcialFacturacion?: number;
  parcialServicios?: number;
  parcialEfectivo?: number;
  parcialMp?: number;
  parcialCostosFijos?: number;
  parcialTasaOcupacion?: number;
  parcialRecargosTotal?: number;
  parcialPerdida?: number;
}

interface IngresoRawRow {
  created_at: string;
  cantidad_de_servicios: number;
  dia: string | null;
}

export interface VentaRow {
  id: string;
  fecha_hora: string;
  servicio_nombre: string | null;
  total_final: number;
}

/**
 * ⚠️ ESPEJO: la lógica de facturación / cantidad de servicios / egresos por tipo_costo
 * también existe en la función SQL public.generar_resumenes_mensuales()
 * (migración 20260801030358_c08bb365-6c9c-4c57-8bea-1d4c9e4d7c28.sql).
 * Si cambiás esta fórmula acá, actualizala también ahí — no hay sincronización automática.
 *
 * Fetch + agregación mensual de Estadísticas. Extraído tal cual del fetchData
 * original de EstadisticasPanel: mismos filtros, mismo resultado, mismo
 * patrón fetch-completo-y-reduce-en-cliente. No reescribe el fetching.
 */
export function useEstadisticasData(
  organizationId: string | undefined,
  currentSucursal: Sucursal | null,
  periodoMeses: string,
  capacidadDiaria: number,
) {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [barberosActivos, setBarberosActivos] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [ventasData, setVentasData] = useState<VentaRow[]>([]);
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

      let ingresosQuery = supabase
        .from('ingresos')
        .select('id, created_at, total_facturado, efectivo, mp, cantidad_de_servicios, sueldo, estado, dia, barbero_id, recargos_total, perdida, comision_productos')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .neq('estado', 'eliminado');

      if (currentSucursal) {
        ingresosQuery = ingresosQuery.eq('sucursal_id', currentSucursal.id);
      }

      let egresosQuery = supabase
        .from('Egresos')
        .select('Monto, tipo_costo, Fecha')
        .eq('organization_id', organizationId)
        .eq('estado', 'activo')
        .gte('Fecha', startDate.toISOString())
        .lte('Fecha', endDate.toISOString());

      if (currentSucursal) {
        egresosQuery = egresosQuery.eq('sucursal_id', currentSucursal.id);
      }

      let barberosQuery = supabase
        .from('barberos')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('activo', true);

      if (currentSucursal) {
        barberosQuery = barberosQuery.eq('sucursal_id', currentSucursal.id);
      }

      let ventasQuery = supabase
        .from('venta')
        // servicio_nombre/total_final se agregaron acá (Build 4) para el donut "Mix de Servicios"
        // y la tasa de attach de extras — reusa esta misma query, no una nueva.
        .select('id, fecha_hora, servicio_nombre, total_final')
        .eq('organization_id', organizationId)
        .eq('estado', 'activo')
        .gte('fecha_hora', startDate.toISOString())
        .lte('fecha_hora', endDate.toISOString());

      if (currentSucursal) {
        ventasQuery = ventasQuery.eq('sucursal_id', currentSucursal.id);
      }

      const [ingresosRes, egresosRes, barberosRes, ventasRes] = await Promise.all([
        ingresosQuery, egresosQuery, barberosQuery, ventasQuery,
      ]);

      if (ingresosRes.error) throw ingresosRes.error;
      if (egresosRes.error) throw egresosRes.error;
      if (barberosRes.error) throw barberosRes.error;

      // Salvaguarda de truncado: mientras este hook siga leyendo filas crudas, avisamos
      // cuando alguna consulta llega al tope de filas en vez de mostrar un parcial.
      setDatosIncompletos(
        alcanzoLimiteFilas(ingresosRes.data) ||
        alcanzoLimiteFilas(egresosRes.data) ||
        alcanzoLimiteFilas(ventasRes.data),
      );

      const ingresos = ingresosRes.data || [];

      const egresos = egresosRes.data || [];
      setBarberosActivos((barberosRes.data || []).length);
      setVentasData((ventasRes.data || []).map((v) => ({
        id: v.id,
        fecha_hora: v.fecha_hora,
        servicio_nombre: v.servicio_nombre,
        total_final: Number(v.total_final) || 0,
      })));
      setIngresosRaw((ingresosRes.data || []).map(i => ({
        created_at: i.created_at,
        cantidad_de_servicios: i.cantidad_de_servicios || 0,
        dia: i.dia || null,
      })));
      const months = eachMonthOfInterval({ start: startDate, end: endDate });

      const today = new Date();
      const diaActual = today.getDate();
      const currentMonthStr = format(today, 'yyyy-MM');

      const monthlyStats: MonthlyData[] = months.map((monthDate, idx) => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const monthIngresos = ingresos.filter(i => {
          if (!i.created_at) return false;
          const d = parseISO(i.created_at);
          return d >= monthStart && d <= monthEnd;
        });

        const monthEgresos = egresos.filter(e => {
          if (!e.Fecha) return false;
          const d = parseISO(e.Fecha);
          return d >= monthStart && d <= monthEnd;
        });

        const costosFijos = monthEgresos.filter(e => e.tipo_costo === 'fijo').reduce((s, e) => s + (Number(e.Monto) || 0), 0);
        const costosVariables = monthEgresos.filter(e => e.tipo_costo === 'variable').reduce((s, e) => s + (Number(e.Monto) || 0), 0);
        const costosSemivariables = monthEgresos.filter(e => e.tipo_costo === 'semivariable').reduce((s, e) => s + (Number(e.Monto) || 0), 0);

        const barberosDelMes = new Set(monthIngresos.map(i => (i as any).barbero_id).filter(Boolean)).size;

        const monthStr = format(monthDate, 'yyyy-MM');
        // Check if the NEXT month in the array is the current month — if so, compute partial sums for first N days
        const nextMonthStr = idx < months.length - 1 ? format(months[idx + 1], 'yyyy-MM') : null;
        const needsPartial = nextMonthStr === currentMonthStr;

        let parcialFacturacion: number | undefined;
        let parcialServicios: number | undefined;
        let parcialEfectivo: number | undefined;
        let parcialMp: number | undefined;
        let parcialCostosFijos: number | undefined;
        let parcialTasaOcupacion: number | undefined;
        let parcialRecargosTotal: number | undefined;
        let parcialPerdida: number | undefined;

        if (needsPartial) {
          // Filter ingresos where day-of-month <= diaActual
          const partialIngresos = monthIngresos.filter(i => {
            const d = parseISO(i.created_at);
            return d.getDate() <= diaActual;
          });
          const partialEgresos = monthEgresos.filter(e => {
            const d = parseISO(e.Fecha!);
            return d.getDate() <= diaActual;
          });

          parcialFacturacion = partialIngresos.reduce((sum, i) => sum + (i.total_facturado || 0), 0);
          parcialServicios = partialIngresos.reduce((sum, i) => sum + (i.cantidad_de_servicios || 0), 0);
          parcialEfectivo = partialIngresos.reduce((sum, i) => sum + (i.efectivo || 0), 0);
          parcialMp = partialIngresos.reduce((sum, i) => sum + (i.mp || 0), 0);
          parcialCostosFijos = partialEgresos.filter(e => e.tipo_costo === 'fijo').reduce((s, e) => s + (Number(e.Monto) || 0), 0);
          parcialRecargosTotal = partialIngresos.reduce((sum, i) => sum + (Number((i as any).recargos_total) || 0), 0);
          parcialPerdida = partialIngresos.reduce((sum, i) => sum + (Number((i as any).perdida) || 0), 0);

          // Partial occupancy: services in first N days / capacity of first N work days
          const [py, pmo] = monthStr.split('-').map(Number);
          const partialWorkDays = getWorkDaysUpTo(py, pmo - 1, diaActual);
          const partialBarberos = new Set(partialIngresos.map(i => (i as any).barbero_id).filter(Boolean)).size;
          const partialCap = capacidadDiaria * (partialBarberos || barberosActivos || 1) * partialWorkDays;
          parcialTasaOcupacion = partialCap > 0 ? (parcialServicios / partialCap) * 100 : 0;
        }

        return {
          month: monthStr,
          monthLabel: format(monthDate, 'MMM yy', { locale: es }),
          facturacion: monthIngresos.reduce((sum, i) => sum + (i.total_facturado || 0), 0),
          servicios: monthIngresos.reduce((sum, i) => sum + (i.cantidad_de_servicios || 0), 0),
          efectivo: monthIngresos.reduce((sum, i) => sum + (i.efectivo || 0), 0),
          mp: monthIngresos.reduce((sum, i) => sum + (i.mp || 0), 0),
          costosFijos,
          costosVariables,
          costosSemivariables,
          totalEgresos: costosFijos + costosVariables + costosSemivariables,
          barberosDelMes,
          recargosTotal: monthIngresos.reduce((sum, i) => sum + (Number((i as any).recargos_total) || 0), 0),
          perdida: monthIngresos.reduce((sum, i) => sum + (Number((i as any).perdida) || 0), 0),
          sueldoTotal: monthIngresos.reduce((sum, i) => sum + (Number((i as any).sueldo) || 0), 0),
          comisionProductos: monthIngresos.reduce((sum, i) => sum + (Number((i as any).comision_productos) || 0), 0),
          parcialFacturacion,
          parcialServicios,
          parcialEfectivo,
          parcialMp,
          parcialCostosFijos,
          parcialTasaOcupacion,
          parcialRecargosTotal,
          parcialPerdida,
        };
      });

      setMonthlyData(monthlyStats);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { monthlyData, barberosActivos, isLoading, ventasData, ingresosRaw };
}
