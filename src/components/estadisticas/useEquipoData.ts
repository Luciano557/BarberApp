import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Sucursal } from '@/contexts/SucursalContext';

export interface BarberoMonthStats {
  month: string;
  monthLabel: string;
  facturacion: number;
  servicios: number;
  comisionDevengada: number;
}

export interface BarberoRankingRow {
  id: string;
  nombre: string;
  facturacion: number;
  servicios: number;
  comisionDevengada: number;
  ticketPromedio: number;
}

export interface ProductoRankingRow {
  id: string;
  nombre: string;
  totalProductos: number;
}

/**
 * Datos para la Sección Equipo: 3 rankings del mes actual (facturación, servicios, comisión
 * devengada) + 1 ranking condicional de venta de productos + historial mensual por barbero
 * (para el detalle al click, sobre el mismo rango de `periodoMeses` que el resto del panel).
 *
 * Filtro de "barbero" en todo el hook: `barberos.roles_equipo` incluye 'barber' — mismo criterio
 * que el fix de DailySummary.tsx / useOcupacionResumen.ts, no el conteo genérico de activos.
 */
export function useEquipoData(
  organizationId: string | undefined,
  currentSucursal: Sucursal | null,
  periodoMeses: string,
) {
  const [rankingActual, setRankingActual] = useState<BarberoRankingRow[]>([]);
  const [productosRanking, setProductosRanking] = useState<ProductoRankingRow[]>([]);
  const [historialPorBarbero, setHistorialPorBarbero] = useState<Map<string, BarberoMonthStats[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, currentSucursal, periodoMeses]);

  const fetchData = async () => {
    if (!organizationId) return;
    setIsLoading(true);

    try {
      const meses = parseInt(periodoMeses);
      const endDate = endOfMonth(new Date());
      const startDate = startOfMonth(subMonths(new Date(), meses - 1));
      const today = new Date();
      const currentMonthStart = startOfMonth(today);
      const currentMonthEnd = endOfMonth(today);
      const currentMonthStr = format(today, 'yyyy-MM');

      let barberosQuery = supabase
        .from('barberos')
        .select('id, nombre, apellido, roles_equipo')
        .eq('organization_id', organizationId)
        .eq('activo', true);
      if (currentSucursal) barberosQuery = barberosQuery.eq('sucursal_id', currentSucursal.id);

      let ingresosQuery = supabase
        .from('ingresos')
        .select('barbero_id, created_at, total_facturado, cantidad_de_servicios, sueldo, comision_productos, estado')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .neq('estado', 'eliminado');
      if (currentSucursal) ingresosQuery = ingresosQuery.eq('sucursal_id', currentSucursal.id);

      // venta_producto tiene organization_id/sucursal_id/created_at propios — no hace falta
      // joinear contra `venta` para filtrar por fecha o sucursal.
      let ventaProductoQuery = supabase
        .from('venta_producto')
        .select('barbero_id, subtotal')
        .eq('organization_id', organizationId)
        .gte('created_at', currentMonthStart.toISOString())
        .lte('created_at', currentMonthEnd.toISOString());
      if (currentSucursal) ventaProductoQuery = ventaProductoQuery.eq('sucursal_id', currentSucursal.id);

      const [barberosRes, ingresosRes, ventaProductoRes] = await Promise.all([
        barberosQuery, ingresosQuery, ventaProductoQuery,
      ]);
      if (barberosRes.error) throw barberosRes.error;
      if (ingresosRes.error) throw ingresosRes.error;
      if (ventaProductoRes.error) throw ventaProductoRes.error;

      const barberosBarber = (barberosRes.data || []).filter(
        (b) => Array.isArray(b.roles_equipo) && (b.roles_equipo as string[]).includes('barber'),
      );
      const nombreMap = new Map<string, string>();
      barberosBarber.forEach((b) => nombreMap.set(b.id, `${b.nombre} ${b.apellido || ''}`.trim()));
      const barberoIds = new Set(nombreMap.keys());

      const ingresos = (ingresosRes.data || []).filter(
        (i) => i.barbero_id && barberoIds.has(i.barbero_id as string),
      );

      // Ranking del mes actual
      const actualByBarbero = new Map<string, { facturacion: number; servicios: number; comision: number }>();
      ingresos.forEach((i) => {
        const mes = format(parseISO(i.created_at), 'yyyy-MM');
        if (mes !== currentMonthStr) return;
        const bid = i.barbero_id as string;
        const acc = actualByBarbero.get(bid) || { facturacion: 0, servicios: 0, comision: 0 };
        acc.facturacion += Number(i.total_facturado) || 0;
        acc.servicios += Number(i.cantidad_de_servicios) || 0;
        acc.comision += (Number(i.sueldo) || 0) + (Number(i.comision_productos) || 0);
        actualByBarbero.set(bid, acc);
      });

      const ranking: BarberoRankingRow[] = Array.from(actualByBarbero.entries()).map(([bid, acc]) => ({
        id: bid,
        nombre: nombreMap.get(bid) || 'Sin nombre',
        facturacion: acc.facturacion,
        servicios: acc.servicios,
        comisionDevengada: acc.comision,
        ticketPromedio: acc.servicios > 0 ? acc.facturacion / acc.servicios : 0,
      }));
      setRankingActual(ranking);

      // Historial mensual por barbero, para el detalle al click (mismo rango que el resto del panel)
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      const historial = new Map<string, BarberoMonthStats[]>();
      barberoIds.forEach((bid) => {
        const ingresosBarbero = ingresos.filter((i) => i.barbero_id === bid);
        const serie: BarberoMonthStats[] = months.map((monthDate) => {
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          const rows = ingresosBarbero.filter((i) => {
            const d = parseISO(i.created_at);
            return d >= monthStart && d <= monthEnd;
          });
          return {
            month: format(monthDate, 'yyyy-MM'),
            monthLabel: format(monthDate, 'MMM yy', { locale: es }),
            facturacion: rows.reduce((s, i) => s + (Number(i.total_facturado) || 0), 0),
            servicios: rows.reduce((s, i) => s + (Number(i.cantidad_de_servicios) || 0), 0),
            comisionDevengada: rows.reduce((s, i) => s + (Number(i.sueldo) || 0) + (Number(i.comision_productos) || 0), 0),
          };
        });
        historial.set(bid, serie);
      });
      setHistorialPorBarbero(historial);

      // Ranking de venta de productos — condicional (ver EstadisticasPanel.tsx: no se renderiza
      // en absoluto si queda vacío).
      const productosPorBarbero = new Map<string, number>();
      (ventaProductoRes.data || []).forEach((vp) => {
        if (!vp.barbero_id || !barberoIds.has(vp.barbero_id)) return;
        productosPorBarbero.set(
          vp.barbero_id,
          (productosPorBarbero.get(vp.barbero_id) || 0) + (Number(vp.subtotal) || 0),
        );
      });
      const productos: ProductoRankingRow[] = Array.from(productosPorBarbero.entries()).map(([bid, total]) => ({
        id: bid,
        nombre: nombreMap.get(bid) || 'Sin nombre',
        totalProductos: total,
      }));
      setProductosRanking(productos);
    } catch (error) {
      console.error('Error fetching datos de equipo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { rankingActual, productosRanking, historialPorBarbero, isLoading };
}
