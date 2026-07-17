import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Sucursal } from '@/contexts/SucursalContext';
import type { VentaRow, MonthlyData } from './useEstadisticasData';

export interface MonthlyServiciosClientesData {
  month: string;
  monthLabel: string;
  tasaAttachExtras: number;
  ingresoExtras: number;
  clientesNuevos: number;
  clientesManual: number;
  clientesImportado: number;
  clientesReserva: number;
  pctEligioBarbero: number;
  /** Solo para el mes en curso: mismo recorte "primeros N días" que el resto del panel. */
  parcialClientesNuevos?: number;
}

/**
 * Datos de la Sección 4 (Servicios y clientes): tasa de attach de extras, clientes nuevos por
 * mes (con desglose de origen) y % que eligió barbero al reservar. El donut "Mix de Servicios"
 * NO vive acá — se deriva directo de `ventasData` (ya extendido con servicio_nombre/total_final)
 * en EstadisticasPanel.tsx, sin fetch propio.
 *
 * `venta_extra` no tiene organization_id/sucursal_id/created_at propios (a diferencia de
 * venta_producto en Build 3) — a diferencia sí necesita el join contra `venta` que la consigna
 * pedía para productos: se resuelve vía los ids de `ventasData`, ya fetcheados por
 * useEstadisticasData con el mismo rango/sucursal.
 */
export function useServiciosClientesData(
  organizationId: string | undefined,
  currentSucursal: Sucursal | null,
  periodoMeses: string,
  ventasData: VentaRow[],
  monthlyData: MonthlyData[],
) {
  const [monthlyStats, setMonthlyStats] = useState<MonthlyServiciosClientesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
    // ventasData/monthlyData llegan del hook hermano useEstadisticasData — cuando terminan de
    // cargar (nueva referencia de array), este efecto recalcula con los datos completos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, currentSucursal, periodoMeses, ventasData, monthlyData]);

  const fetchData = async () => {
    if (!organizationId) return;
    setIsLoading(true);

    try {
      const meses = parseInt(periodoMeses);
      const endDate = endOfMonth(new Date());
      const startDate = startOfMonth(subMonths(new Date(), meses - 1));
      const today = new Date();
      const diaActual = today.getDate();
      const currentMonthStr = format(today, 'yyyy-MM');

      const ventaIds = ventasData.map((v) => v.id);

      // `clientes` no tiene columna sucursal_id (confirmado en integrations/supabase/types.ts) —
      // "Clientes nuevos" queda a nivel organización aunque haya un filtro de sucursal activo.
      // Ver nota en AUDITORIA_DATOS_ESTADISTICAS.md, Build 4.
      const clientesQuery = supabase
        .from('clientes')
        .select('created_at, origen')
        .eq('organization_id', organizationId)
        .eq('eliminado', false)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      let turnosQuery = supabase
        .from('turnos')
        .select('fecha, eligio_barbero')
        .eq('organization_id', organizationId)
        .gte('fecha', format(startDate, 'yyyy-MM-dd'))
        .lte('fecha', format(endDate, 'yyyy-MM-dd'));
      if (currentSucursal) turnosQuery = turnosQuery.eq('sucursal_id', currentSucursal.id);

      const [clientesRes, turnosRes] = await Promise.all([clientesQuery, turnosQuery]);
      if (clientesRes.error) throw clientesRes.error;
      if (turnosRes.error) throw turnosRes.error;

      // venta_extra no tiene organization_id/sucursal_id/created_at propios (a diferencia de
      // venta_producto en Build 3) — se filtra vía los ids de `ventasData`, ya acotados por
      // rango y sucursal en useEstadisticasData.
      let extrasData: { venta_id: string; cantidad: number; precio_extra: number }[] = [];
      if (ventaIds.length > 0) {
        const { data, error } = await supabase
          .from('venta_extra')
          .select('venta_id, cantidad, precio_extra')
          .in('venta_id', ventaIds);
        if (error) throw error;
        extrasData = data || [];
      }

      const extrasPorVenta = new Map<string, { cantidad: number; ingreso: number }>();
      extrasData.forEach((e) => {
        const acc = extrasPorVenta.get(e.venta_id) || { cantidad: 0, ingreso: 0 };
        acc.cantidad += Number(e.cantidad) || 0;
        acc.ingreso += (Number(e.cantidad) || 0) * (Number(e.precio_extra) || 0);
        extrasPorVenta.set(e.venta_id, acc);
      });

      const clientes = clientesRes.data || [];
      const turnos = turnosRes.data || [];

      const months = eachMonthOfInterval({ start: startDate, end: endDate });

      const stats: MonthlyServiciosClientesData[] = months.map((monthDate, idx) => {
        const monthStr = format(monthDate, 'yyyy-MM');
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const ventasDelMes = ventasData.filter((v) => {
          const d = parseISO(v.fecha_hora);
          return d >= monthStart && d <= monthEnd;
        });
        const extrasCantidad = ventasDelMes.reduce((sum, v) => sum + (extrasPorVenta.get(v.id)?.cantidad || 0), 0);
        const extrasIngreso = ventasDelMes.reduce((sum, v) => sum + (extrasPorVenta.get(v.id)?.ingreso || 0), 0);
        const serviciosDelMes = monthlyData.find((m) => m.month === monthStr)?.servicios ?? 0;
        const tasaAttachExtras = serviciosDelMes > 0 ? (extrasCantidad / serviciosDelMes) * 100 : 0;

        const clientesDelMes = clientes.filter((c) => {
          const d = parseISO(c.created_at);
          return d >= monthStart && d <= monthEnd;
        });
        const clientesNuevos = clientesDelMes.length;
        const clientesManual = clientesDelMes.filter((c) => c.origen === 'manual').length;
        const clientesImportado = clientesDelMes.filter((c) => c.origen === 'importado').length;
        const clientesReserva = clientesDelMes.filter((c) => c.origen === 'reserva').length;

        const turnosDelMes = turnos.filter((t) => {
          const d = parseISO(t.fecha);
          return d >= monthStart && d <= monthEnd;
        });
        const pctEligioBarbero = turnosDelMes.length > 0
          ? (turnosDelMes.filter((t) => t.eligio_barbero).length / turnosDelMes.length) * 100
          : 0;

        // Parcial (mismos primeros N días) solo para clientesNuevos — mismo patrón "cumulative"
        // que Facturación/Servicios en useEstadisticasData; attach % y % eligió barbero son
        // ratios, se comparan mes completo contra mes completo, sin recorte.
        const nextMonthStr = idx < months.length - 1 ? format(months[idx + 1], 'yyyy-MM') : null;
        let parcialClientesNuevos: number | undefined;
        if (nextMonthStr === currentMonthStr) {
          parcialClientesNuevos = clientesDelMes.filter((c) => parseISO(c.created_at).getDate() <= diaActual).length;
        }

        return {
          month: monthStr,
          monthLabel: format(monthDate, 'MMM yy', { locale: es }),
          tasaAttachExtras,
          ingresoExtras: extrasIngreso,
          clientesNuevos,
          clientesManual,
          clientesImportado,
          clientesReserva,
          pctEligioBarbero,
          parcialClientesNuevos,
        };
      });

      setMonthlyStats(stats);
    } catch (error) {
      console.error('Error fetching datos de servicios y clientes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { monthlyStats, isLoading };
}
