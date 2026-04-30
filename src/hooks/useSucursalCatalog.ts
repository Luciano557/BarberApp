import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service, Extra, Discount, Line } from '@/types/barbershop';

/**
 * Lectura aislada del catálogo (servicios + extras + descuentos) para una
 * sucursal específica, SIN modificar el SucursalContext global.
 *
 * Pensado para que owner/general_manager consulten el catálogo de una sucursal
 * arbitraria desde tabs futuras (p. ej. Mi Negocio > Sucursal X). No expone
 * mutaciones; las mutaciones por sucursal específica se agregarán en el paso
 * siguiente reutilizando las mismas RPCs apuntadas a este sucursalId.
 *
 * Si falta una fila en *_sucursales para esta sucursal, el ítem se omite y se
 * loguea un warning (no se crea desde el frontend).
 */

type ServicioSucursalRow = { id: string; servicio_id: string; sucursal_id: string; precio: number; activo: boolean };
type ExtraSucursalRow = { id: string; extra_id: string; sucursal_id: string; precio: number; activo: boolean };
type DescuentoSucursalRow = { id: string; descuento_id: string; sucursal_id: string; activo: boolean };

function buildService(row: any, lines: Line[], br: ServicioSucursalRow): Service {
  const line = lines.find(l => l.id === row.linea_id);
  const globalActive = !!row.activo;
  const branchActive = !!br.activo;
  const price = Number(br.precio);
  return {
    id: row.id,
    uid: row.id,
    name: row.nombre,
    price,
    durationMin: row.duracion_min ?? 30,
    lineId: row.linea_id || undefined,
    lineName: line?.name,
    sucursalId: row.sucursal_id || undefined,
    active: globalActive && branchActive,
    globalActive,
    branchActive,
    sucursalConfigId: br.id,
    priceConfigured: price > 0,
  };
}

function buildExtra(row: any, br: ExtraSucursalRow): Extra {
  const globalActive = !!row.activo;
  const branchActive = !!br.activo;
  const price = Number(br.precio);
  return {
    id: row.id,
    uid: row.id,
    name: row.nombre,
    price,
    sucursalId: row.sucursal_id || undefined,
    active: globalActive && branchActive,
    globalActive,
    branchActive,
    sucursalConfigId: br.id,
    priceConfigured: price > 0,
  };
}

function buildDiscount(row: any, br: DescuentoSucursalRow): Discount {
  const globalActive = row.activo !== false;
  const branchActive = !!br.activo;
  return {
    id: row.id,
    label: row.nombre,
    value: Number(row.valor),
    type: row.tipo === 'monto' ? 'fixed' : 'percentage',
    rounding: row.redondeo || 'cliente',
    roundingUnit: Number(row.redondeo_unidad) || 100,
    paymentMethod: row.metodo_pago || 'todos',
    sucursalId: row.sucursal_id || undefined,
    appliesTo: row.aplica_a === 'productos' ? 'productos' : 'servicios',
    active: globalActive && branchActive,
    globalActive,
    branchActive,
    sucursalConfigId: br.id,
  };
}

export function useSucursalCatalog(sucursalId: string | null) {
  const [services, setServices] = useState<Service[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!sucursalId);

  const fetchAll = useCallback(async () => {
    if (!sucursalId) {
      setServices([]);
      setExtras([]);
      setDiscounts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [linesRes, servRes, extRes, descRes, servSucRes, extSucRes, descSucRes] = await Promise.all([
        supabase.from('lineas').select('*').order('nombre'),
        supabase.from('servicios').select('*').order('nombre'),
        supabase.from('extras').select('*').order('nombre'),
        supabase.from('descuentos').select('*').order('valor'),
        supabase.from('servicios_sucursales').select('*').eq('sucursal_id', sucursalId),
        supabase.from('extras_sucursales').select('*').eq('sucursal_id', sucursalId),
        supabase.from('descuentos_sucursales').select('*').eq('sucursal_id', sucursalId),
      ]);

      if (linesRes.error) throw linesRes.error;
      if (servRes.error) throw servRes.error;
      if (extRes.error) throw extRes.error;
      if (descRes.error) throw descRes.error;
      if (servSucRes.error) throw servSucRes.error;
      if (extSucRes.error) throw extSucRes.error;
      if (descSucRes.error) throw descSucRes.error;

      const lines: Line[] = linesRes.data.map((r: any) => ({
        id: r.id,
        name: r.nombre,
        color: r.color || undefined,
        active: r.activo,
      }));

      const servSucMap = new Map<string, ServicioSucursalRow>();
      ((servSucRes.data as ServicioSucursalRow[]) || []).forEach(r => servSucMap.set(r.servicio_id, r));
      const extSucMap = new Map<string, ExtraSucursalRow>();
      ((extSucRes.data as ExtraSucursalRow[]) || []).forEach(r => extSucMap.set(r.extra_id, r));
      const descSucMap = new Map<string, DescuentoSucursalRow>();
      ((descSucRes.data as DescuentoSucursalRow[]) || []).forEach(r => descSucMap.set(r.descuento_id, r));

      const builtServices: Service[] = [];
      for (const row of servRes.data) {
        const br = servSucMap.get(row.id);
        if (!br) {
          console.warn('[useSucursalCatalog] Falta servicios_sucursales para servicio', row.id, 'sucursal', sucursalId);
          continue;
        }
        builtServices.push(buildService(row, lines, br));
      }
      const builtExtras: Extra[] = [];
      for (const row of extRes.data) {
        const br = extSucMap.get(row.id);
        if (!br) {
          console.warn('[useSucursalCatalog] Falta extras_sucursales para extra', row.id, 'sucursal', sucursalId);
          continue;
        }
        builtExtras.push(buildExtra(row, br));
      }
      const builtDiscounts: Discount[] = [];
      for (const row of descRes.data) {
        const br = descSucMap.get(row.id);
        if (!br) {
          console.warn('[useSucursalCatalog] Falta descuentos_sucursales para descuento', row.id, 'sucursal', sucursalId);
          continue;
        }
        builtDiscounts.push(buildDiscount(row, br));
      }

      setServices(builtServices);
      setExtras(builtExtras);
      setDiscounts(builtDiscounts);
    } catch (err) {
      console.error('[useSucursalCatalog] error', err);
      setServices([]);
      setExtras([]);
      setDiscounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [sucursalId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    services,
    extras,
    discounts,
    isLoading,
    refresh: fetchAll,
  };
}
