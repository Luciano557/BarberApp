import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Sucursal } from '@/contexts/SucursalContext';
import type { MonthlyData } from './useEstadisticasData';

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
 * mes (con desglose de origen) y % que eligió barbero al reservar.
 *
 * `venta_extra` no tiene organization_id/sucursal_id/created_at propios, por lo que se resuelve
 * server-side vía embed `!inner` a `venta` (INNER JOIN en PostgREST) filtrando por
 * organización, sucursal, estado y rango sobre `venta.fecha_hora`. Esto evita materializar una
 * lista larga de UUIDs en cliente y el consecuente 400 Bad Request por URL demasiado larga.
 */
export function useServiciosClientesData(
  organizationId: string | undefined,
  currentSucursal: Sucursal | null,
  periodoMeses: string,
  monthlyData: MonthlyData[],
) {
  const [monthlyStats, setMonthlyStats] = useState<MonthlyServiciosClientesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
    // `ventasData` se retiró de las dependencias: la query de venta_extra ahora filtra
    // server-side vía embed a `venta`, sin depender del array de IDs del hook hermano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, currentSucursal, periodoMeses, monthlyData]);

  const fetchData = async () => {
    if (!organizationId) return;

    // Guard: evita que un ciclo temprano (antes de que useEstadisticasData termine) pise el
    // estado con ceros. monthlyData se publica con longitud = período cuando termina de
    // cargar; length === 0 ⇒ el hook padre aún no resolvió.
    if (monthlyData.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const meses = parseInt(periodoMeses);
      const endDate = endOfMonth(new Date());
      const startDate = startOfMonth(subMonths(new Date(), meses - 1));
      const today = new Date();
      const diaActual = today.getDate();
      const currentMonthStr = format(today, 'yyyy-MM');

      // `clientes` no tiene columna sucursal_id — "Clientes nuevos" queda a nivel organización
      // aunque haya un filtro de sucursal activo.
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

      // venta_extra vía embed `!inner` — los filtros sobre `venta.*` se resuelven en Postgres,
      // sin exponer ninguna lista de UUIDs en la URL. Se tipa el select como `string` plano
      // para no disparar el parser de tipos costoso de supabase-js sobre el embed.
      const sel = (s: string): string => s;
      let extrasQuery = supabase
        .from('venta_extra')
        .select(sel('venta_id, cantidad, precio_extra, venta!inner(fecha_hora, organization_id, sucursal_id, estado)'))
        .eq('venta.organization_id', organizationId)
        .eq('venta.estado', 'activo')
        .gte('venta.fecha_hora', startDate.toISOString())
        .lte('venta.fecha_hora', endDate.toISOString());
      if (currentSucursal) extrasQuery = extrasQuery.eq('venta.sucursal_id', currentSucursal.id);

      type ExtraRow = {
        venta_id: string;
        cantidad: number | null;
        precio_extra: number | null;
        venta: { fecha_hora: string } | null;
      };

      const [clientesRes, turnosRes, extrasRes] = await Promise.all([
        clientesQuery,
        turnosQuery,
        extrasQuery.returns<ExtraRow[]>(),
      ]);
      if (clientesRes.error) throw clientesRes.error;
      if (turnosRes.error) throw turnosRes.error;
      if (extrasRes.error) throw extrasRes.error;

      const extrasData: ExtraRow[] = extrasRes.data ?? [];
      const clientes = clientesRes.data || [];
      const turnos = turnosRes.data || [];

      const months = eachMonthOfInterval({ start: startDate, end: endDate });

      const stats: MonthlyServiciosClientesData[] = months.map((monthDate, idx) => {
        const monthStr = format(monthDate, 'yyyy-MM');
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        // Ahora cada fila de venta_extra trae `fecha_hora` embebida — se agrega directo,
        // sin cruzar contra un Map de ventasData.
        let extrasCantidad = 0;
        let extrasIngreso = 0;
        for (const e of extrasData) {
          if (!e.venta?.fecha_hora) continue;
          const d = parseISO(e.venta.fecha_hora);
          if (d < monthStart || d > monthEnd) continue;
          const cant = Number(e.cantidad) || 0;
          const precio = Number(e.precio_extra) || 0;
          extrasCantidad += cant;
          extrasIngreso += cant * precio;
        }
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

        // Parcial (mismos primeros N días) solo para clientesNuevos — mismo patrón cumulativo
        // que Facturación/Servicios en useEstadisticasData; los ratios se comparan mes completo.
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
    } catch (err) {
      console.error('Error fetching datos de servicios y clientes:', err);
      setError('No se pudieron cargar las métricas de servicios y clientes');
    } finally {
      setIsLoading(false);
    }
  };

  return { monthlyStats, isLoading, error };
}
