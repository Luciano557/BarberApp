import { runFinanceWrite } from '@/lib/financeDemoRuntime';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { useFinanceDemo } from '@/contexts/FinanceDemoContext';
import { useOperationalAccess, type OperationalReadOptions } from '@/hooks/useOperationalAccess';
import type { Barber } from '@/types/barbershop';
import { toast } from 'sonner';
import { format, startOfMonth, differenceInCalendarDays, getDaysInMonth, addMonths, startOfDay, endOfMonth, isBefore, isSameMonth, addDays, addWeeks, addYears } from 'date-fns';

/**
 * Calcula el devengado de sueldo fijo usando meses calendario reales.
 * Meses completos = sueldoFijo exacto. Meses parciales = prorrateo por días reales del mes.
 */
function calcularDevengadoFijo(sueldoFijo: number, desde: Date, hasta: Date): number {
  if (isBefore(hasta, desde)) return 0;
  
  // Si están en el mismo mes, prorratear
  if (isSameMonth(desde, hasta)) {
    const diasMes = getDaysInMonth(desde);
    const dias = differenceInCalendarDays(hasta, desde);
    return sueldoFijo * (dias / diasMes);
  }
  
  let total = 0;
  
  // Primer mes parcial: desde el día de inicio hasta fin del mes
  const finPrimerMes = endOfMonth(desde);
  const diasPrimerMes = getDaysInMonth(desde);
  const diasEnPrimerMes = differenceInCalendarDays(finPrimerMes, desde) + 1; // +1 para incluir el último día
  total += sueldoFijo * (diasEnPrimerMes / diasPrimerMes);
  
  // Meses completos intermedios
  let cursor = startOfDay(addMonths(startOfMonth(desde), 1));
  while (cursor.getFullYear() < hasta.getFullYear() || 
         (cursor.getFullYear() === hasta.getFullYear() && cursor.getMonth() < hasta.getMonth())) {
    total += sueldoFijo;
    cursor = addMonths(cursor, 1);
  }
  
  // Último mes parcial (si estamos en un mes diferente al primero)
  const inicioUltimoMes = startOfMonth(hasta);
  const diasUltimoMes = getDaysInMonth(hasta);
  const diasEnUltimoMes = differenceInCalendarDays(hasta, inicioUltimoMes);
  if (diasEnUltimoMes > 0) {
    total += sueldoFijo * (diasEnUltimoMes / diasUltimoMes);
  }
  
  return total;
}

function calcNextDate(current: Date, preset: string, frequency?: string | null, interval?: number | null, byweekday?: number[] | null): Date {
  const n = interval || 1;
  switch (preset) {
    case 'daily': return addDays(current, 1);
    case 'weekdays': { let next = addDays(current, 1); while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1); return next; }
    case 'weekends': { let next = addDays(current, 1); while (next.getDay() !== 0 && next.getDay() !== 6) next = addDays(next, 1); return next; }
    case 'weekly': return addWeeks(current, 1);
    case 'biweekly': return addWeeks(current, 2);
    case 'monthly': return addMonths(current, 1);
    case 'quarterly': return addMonths(current, 3);
    case 'semiannual': return addMonths(current, 6);
    case 'yearly': return addYears(current, 1);
    case 'custom': {
      const freq = frequency || 'monthly';
      switch (freq) {
        case 'daily': return addDays(current, n);
        case 'weekly': {
          if (byweekday?.length) {
            const sorted = [...byweekday].sort((a, b) => a - b);
            const currentDay = current.getDay();
            const nextDay = sorted.find(d => d > currentDay);
            if (nextDay !== undefined) return addDays(current, nextDay - currentDay);
            return addDays(current, 7 * (n - 1) + (7 - currentDay + sorted[0]));
          }
          return addWeeks(current, n);
        }
        case 'monthly': return addMonths(current, n);
        case 'yearly': return addYears(current, n);
        default: return addMonths(current, n);
      }
    }
    default: return addMonths(current, 1);
  }
}

// Define interface for raw ingresos data from Supabase
interface IngresoRaw {
  id: number;
  barbero: string | null;
  barbero_id: string | null;
  sueldo: number | null;
  total_facturado: number | null;
  efectivo: number | null;
  mp: number | null;
  dia: string | null;
  created_at: string;
}

interface ComisionEquipoDetalle {
  barberoOrigenId: string;
  barberoOrigenNombre: string;
  porcentajeActual: number;
  montoTotal: number;
}

interface BonoFijoOcurrencia {
  fecha: string;
  monto: number;
}

export interface BarberSalaryData {
  barberId: string;
  barberName: string;
  compensationType: string;
  totalDevengado: number;
  totalPagado: number;
  saldo: number;
  detalleIngresos: IngresoDetalle[];
  detallePagos: PagoDetalle[];
  fixedSalaryInfo?: { sueldoFijo: number; dias: number; devengado: number };
  comisionExtraEquipo?: ComisionEquipoDetalle[];
  bonoFijoOcurrencias?: BonoFijoOcurrencia[];
  bonoFijoTotal?: number;
  comisionProductosTotal?: number;
}

interface IngresoDetalle {
  id: number;
  fecha: string;
  dia: string;
  totalFacturado: number;
  sueldo: number;
  efectivo: number;
  mp: number;
}

interface PagoDetalle {
  id: string;
  fecha: string;
  monto: number;
  concepto: string | null;
}

export interface PagoSueldo {
  id: string;
  barbero_id: string;
  barbero_nombre: string;
  monto: number;
  fecha: string;
  concepto: string | null;
  created_at: string;
}

export function useSueldosData(barbers: Barber[], periodStartDate?: Date, periodEndDate?: Date, options: OperationalReadOptions = {}) {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const demo = useFinanceDemo();
  const enabled = options.enabled !== false && !demo.active;
  const access = useOperationalAccess(enabled);
  const [salaryData, setSalaryData] = useState<BarberSalaryData[]>([]);
  const [pagos, setPagos] = useState<PagoSueldo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const fetchData = useCallback(async () => {
    if (!organization || !enabled || !access.allowed()) return;
    const request = access.start();
    
    setIsLoading(true);
    try {
      // Fetch created_at for barbers with fixed salary (for historical accrual)
      const fixedBarberIds = barbers.filter(b => b.compensationType === 'fijo' && b.fixedSalary).map(b => b.id);
      const barberCreatedAtMap: Record<string, string> = {};
      if (fixedBarberIds.length > 0) {
        if (!request.current()) return;
        const { data: barberDates } = await supabase
          .from('barberos')
          .select('id, created_at')
          .in('id', fixedBarberIds).abortSignal(request.signal);
        if (!request.current()) return;
        barberDates?.forEach(b => { barberCreatedAtMap[b.id] = b.created_at; });
      }

      // ALWAYS fetch ALL data for saldo calculation (historical)
      let ingHistQuery = supabase
        .from('ingresos')
        .select('barbero_id, sueldo, comision_productos')
        .eq('organization_id', organization.id)
        .eq('estado', 'activo');
      if (currentSucursal) ingHistQuery = ingHistQuery.eq('sucursal_id', currentSucursal.id);

      if (!request.current()) return;
      const { data: ingresosHistoricos, error: ingresosHistoricosError } = await ingHistQuery.abortSignal(request.signal);
      if (!request.current()) return;
      if (ingresosHistoricosError) throw ingresosHistoricosError;

      let pagHistQuery = supabase
        .from('pagos_sueldos')
        .select('barbero_id, monto')
        .eq('organization_id', organization.id);
      if (currentSucursal) pagHistQuery = pagHistQuery.eq('sucursal_id', currentSucursal.id);

      if (!request.current()) return;
      const { data: pagosHistoricos, error: pagosHistoricosError } = await pagHistQuery.abortSignal(request.signal);
      if (!request.current()) return;
      if (pagosHistoricosError) throw pagosHistoricosError;

      // Calculate HISTORICAL totals for saldo (real debt - never changes with filter)
      const devengadoHistoricoPorId: Record<string, number> = {};
      const comisionProdHistoricoPorId: Record<string, number> = {};
      ingresosHistoricos?.forEach((ingreso) => {
        const barberoId = ingreso.barbero_id;
        if (barberoId) {
          devengadoHistoricoPorId[barberoId] = (devengadoHistoricoPorId[barberoId] || 0) + (ingreso.sueldo || 0);
          const cp = Number(ingreso.comision_productos) || 0;
          devengadoHistoricoPorId[barberoId] += cp;
          comisionProdHistoricoPorId[barberoId] = (comisionProdHistoricoPorId[barberoId] || 0) + cp;
        }
      });

      const pagadoHistoricoPorId: Record<string, number> = {};
      pagosHistoricos?.forEach(pago => {
        const barberoId = pago.barbero_id;
        if (barberoId) {
          pagadoHistoricoPorId[barberoId] = (pagadoHistoricoPorId[barberoId] || 0) + pago.monto;
        }
      });

      // Build query for ingresos - filtered by period if set (for display)
      let ingresosQuery = supabase
        .from('ingresos')
        .select('id, barbero, barbero_id, sueldo, total_facturado, efectivo, mp, dia, created_at, comision_productos')
        .eq('organization_id', organization.id)
        .eq('estado', 'activo')
        .order('created_at', { ascending: false });
      
      if (currentSucursal) {
        ingresosQuery = ingresosQuery.eq('sucursal_id', currentSucursal.id);
      }
      
      if (periodStartDate) {
        const startDateStr = format(periodStartDate, 'yyyy-MM-dd');
        ingresosQuery = ingresosQuery.gte('created_at', `${startDateStr}T00:00:00`);
      }
      if (periodEndDate) {
        const endDateStr = format(periodEndDate, 'yyyy-MM-dd');
        ingresosQuery = ingresosQuery.lte('created_at', `${endDateStr}T23:59:59`);
      }

      if (!request.current()) return;
      const { data: ingresosFiltrados, error: ingresosFiltradosError } = await ingresosQuery.abortSignal(request.signal);
      if (!request.current()) return;
      if (ingresosFiltradosError) throw ingresosFiltradosError;

      // Fetch pagos filtered by period (for display)
      let pagosQuery = supabase
        .from('pagos_sueldos')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      
      if (currentSucursal) {
        pagosQuery = pagosQuery.eq('sucursal_id', currentSucursal.id);
      }
      
      if (periodStartDate) {
        const startDateStr = format(periodStartDate, 'yyyy-MM-dd');
        pagosQuery = pagosQuery.gte('created_at', `${startDateStr}T00:00:00`);
      }
      if (periodEndDate) {
        const endDateStr = format(periodEndDate, 'yyyy-MM-dd');
        pagosQuery = pagosQuery.lte('created_at', `${endDateStr}T23:59:59`);
      }

      if (!request.current()) return;
      const { data: pagosFiltrados, error: pagosFiltradosError } = await pagosQuery.abortSignal(request.signal);
      if (!request.current()) return;
      if (pagosFiltradosError) throw pagosFiltradosError;

      setPagos(pagosFiltrados || []);

      // Calculate FILTERED devengado per barber (for display)
      const devengadoFiltradoPorId: Record<string, number> = {};
      const comisionProdFiltradoPorId: Record<string, number> = {};
      ingresosFiltrados?.forEach(ingreso => {
        const barberoId = ingreso.barbero_id;
        if (barberoId) {
          devengadoFiltradoPorId[barberoId] = (devengadoFiltradoPorId[barberoId] || 0) + (ingreso.sueldo || 0);
          const cp = Number(ingreso.comision_productos) || 0;
          comisionProdFiltradoPorId[barberoId] = (comisionProdFiltradoPorId[barberoId] || 0) + cp;
        }
      });

      // Calculate FILTERED pagado per barber (for display)
      const pagadoFiltradoPorId: Record<string, number> = {};
      pagosFiltrados?.forEach(pago => {
        const barberoId = pago.barbero_id;
        if (barberoId) {
          pagadoFiltradoPorId[barberoId] = (pagadoFiltradoPorId[barberoId] || 0) + pago.monto;
        }
      });

      // === Comision Extra por Equipo: fetch configs + rules ===
      if (!request.current()) return;
      const { data: comisionConfigs } = await supabase
        .from('comision_equipo_config')
        .select('id, encargado_id, activa, scope_type, sucursal_id')
        .eq('organization_id', organization.id)
        .eq('activa', true).abortSignal(request.signal);
      if (!request.current()) return;

      // For each active config, fetch ALL rules that overlap with the period (for filtered view)
      // and ALL rules (for historical saldo)
      let allComisionReglas: { config_id: string; barbero_origen_id: string; porcentaje: number; vigencia_desde: string; vigencia_hasta: string | null }[] = [];
      if (comisionConfigs && comisionConfigs.length > 0) {
        const configIds = comisionConfigs.map(c => c.id);
        if (!request.current()) return;
        const { data: reglasData } = await supabase
          .from('comision_equipo_reglas')
          .select('config_id, barbero_origen_id, porcentaje, vigencia_desde, vigencia_hasta')
          .in('config_id', configIds)
          .eq('activa', true).abortSignal(request.signal);
        if (!request.current()) return;
        allComisionReglas = reglasData || [];
      }

      // Helper: find applicable rule for a given date
      const findRegla = (configId: string, barberoOrigenId: string, fechaCierre: string) => {
        return allComisionReglas.find(r =>
          r.config_id === configId &&
          r.barbero_origen_id === barberoOrigenId &&
          r.vigencia_desde <= fechaCierre &&
          (r.vigencia_hasta === null || r.vigencia_hasta >= fechaCierre)
        );
      };

      // Pre-compute comision extra per encargado using ALL ingresos (historical) and filtered ingresos
      // We need ALL active ingresos for historical calc, and filtered ones for display
      // The historical ingresos are already fetched (ingresosHistoricos) but without full detail
      // We need total_facturado + created_at per barbero_id for commission calc
      // Fetch these separately for commission
      let comisionIngresosForCalc: { barbero_id: string; total_facturado: number; created_at: string }[] = [];
      if (comisionConfigs && comisionConfigs.length > 0) {
        // Get all unique barbero_origen_ids from rules
        const origenIds = [...new Set(allComisionReglas.map(r => r.barbero_origen_id))];
        if (origenIds.length > 0) {
          let comIngQuery = supabase
            .from('ingresos')
            .select('barbero_id, total_facturado, created_at')
            .eq('organization_id', organization.id)
            .eq('estado', 'activo')
            .in('barbero_id', origenIds);
          if (currentSucursal) comIngQuery = comIngQuery.eq('sucursal_id', currentSucursal.id);
          if (!request.current()) return;
          const { data: comIngData } = await comIngQuery.abortSignal(request.signal);
          if (!request.current()) return;
          comisionIngresosForCalc = (comIngData || []).map(i => ({
            barbero_id: i.barbero_id || '',
            total_facturado: Number(i.total_facturado) || 0,
            created_at: i.created_at,
          }));
        }
      }

      // Calculate per-encargado commission (historical and filtered)
      type ComisionResult = { historico: Record<string, { nombre: string; porcentaje: number; monto: number }>; filtrado: Record<string, { nombre: string; porcentaje: number; monto: number }> };
      const comisionPorEncargado: Record<string, ComisionResult> = {};

      if (comisionConfigs) {
        for (const cfg of comisionConfigs) {
          const encargadoId = cfg.encargado_id;
          const configId = cfg.id;
          const result: ComisionResult = { historico: {}, filtrado: {} };

          for (const ingreso of comisionIngresosForCalc) {
            const fechaCierre = format(new Date(ingreso.created_at), 'yyyy-MM-dd');
            const regla = findRegla(configId, ingreso.barbero_id, fechaCierre);
            if (!regla) continue;

            const comision = ingreso.total_facturado * regla.porcentaje / 100;
            const barberOrigen = barbers.find(b => b.id === ingreso.barbero_id);
            const nombre = barberOrigen ? `${barberOrigen.firstName} ${barberOrigen.lastName}`.trim() : 'Barbero';

            // Historical
            if (!result.historico[ingreso.barbero_id]) {
              result.historico[ingreso.barbero_id] = { nombre, porcentaje: regla.porcentaje, monto: 0 };
            }
            result.historico[ingreso.barbero_id].monto += comision;
            result.historico[ingreso.barbero_id].porcentaje = regla.porcentaje; // last one wins

            // Filtered (only if within period)
            const inPeriod = (!periodStartDate || fechaCierre >= format(periodStartDate, 'yyyy-MM-dd')) &&
              (!periodEndDate || fechaCierre <= format(periodEndDate, 'yyyy-MM-dd'));
            if (inPeriod) {
              if (!result.filtrado[ingreso.barbero_id]) {
                result.filtrado[ingreso.barbero_id] = { nombre, porcentaje: regla.porcentaje, monto: 0 };
              }
              result.filtrado[ingreso.barbero_id].monto += comision;
              result.filtrado[ingreso.barbero_id].porcentaje = regla.porcentaje;
            }
          }

          comisionPorEncargado[encargadoId] = result;
        }
      }

      // === Bono Fijo: sync pending occurrences ===
      const hoyStr = format(new Date(), 'yyyy-MM-dd');
      const bonoQuery = supabase
        .from('bono_fijo_config')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('activa', true)
        .lte('proxima_fecha', hoyStr);
      
      if (!request.current()) return;
      const { data: bonosPendientes } = await bonoQuery.abortSignal(request.signal);
      if (!request.current()) return;
      if (bonosPendientes && bonosPendientes.length > 0) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        for (const bono of bonosPendientes) {
          let nextDate = new Date(bono.proxima_fecha + 'T12:00:00');
          const endDate = bono.fecha_fin ? new Date(bono.fecha_fin + 'T12:00:00') : new Date('9999-12-31T12:00:00');

          while (nextDate <= today && nextDate <= endDate) {
            const fechaStr = format(nextDate, 'yyyy-MM-dd');
            // Insert with ON CONFLICT DO NOTHING (upsert-safe)
            if (!request.current()) return;
            await runFinanceWrite(async () => supabase
              .from('bono_fijo_ocurrencias')
              .upsert({
                organization_id: bono.organization_id,
                sucursal_id: bono.sucursal_id,
                config_id: bono.id,
                barbero_id: bono.barbero_id,
                monto: bono.monto,
                fecha: fechaStr,
              }, { onConflict: 'config_id,fecha', ignoreDuplicates: true }).abortSignal(request.signal));
            if (!request.current()) return;

            nextDate = calcNextDate(
              nextDate,
              bono.repeat_preset,
              bono.repeat_frequency,
              bono.repeat_interval,
              bono.repeat_byweekday,
            );
          }

          // Update proxima_fecha
          if (!request.current()) return;
          await runFinanceWrite(async () => supabase
            .from('bono_fijo_config')
            .update({ proxima_fecha: format(nextDate, 'yyyy-MM-dd') })
            .eq('id', bono.id).abortSignal(request.signal));
          if (!request.current()) return;
        }
      }

      // Fetch ALL bono fijo ocurrencias for the org (historical)
      let bonoOcurrenciasQuery = supabase
        .from('bono_fijo_ocurrencias')
        .select('barbero_id, monto, fecha')
        .eq('organization_id', organization.id);
      if (currentSucursal) bonoOcurrenciasQuery = bonoOcurrenciasQuery.eq('sucursal_id', currentSucursal.id);
      if (!request.current()) return;
      const { data: allBonoOcurrencias } = await bonoOcurrenciasQuery.abortSignal(request.signal);
      if (!request.current()) return;

      // Group by barbero_id
      const bonoHistoricoPorId: Record<string, number> = {};
      const bonoOcurrenciasPorId: Record<string, BonoFijoOcurrencia[]> = {};
      const bonoFiltradoPorId: Record<string, { total: number; ocurrencias: BonoFijoOcurrencia[] }> = {};

      (allBonoOcurrencias || []).forEach((o) => {
        const bid = o.barbero_id;
        const m = Number(o.monto) || 0;
        // Historical total
        bonoHistoricoPorId[bid] = (bonoHistoricoPorId[bid] || 0) + m;
        if (!bonoOcurrenciasPorId[bid]) bonoOcurrenciasPorId[bid] = [];
        bonoOcurrenciasPorId[bid].push({ fecha: o.fecha, monto: m });

        // Filtered
        const inPeriod = (!periodStartDate || o.fecha >= format(periodStartDate, 'yyyy-MM-dd')) &&
          (!periodEndDate || o.fecha <= format(periodEndDate, 'yyyy-MM-dd'));
        if (inPeriod) {
          if (!bonoFiltradoPorId[bid]) bonoFiltradoPorId[bid] = { total: 0, ocurrencias: [] };
          bonoFiltradoPorId[bid].total += m;
          bonoFiltradoPorId[bid].ocurrencias.push({ fecha: o.fecha, monto: m });
        }
      });

      // Build salary data for active barbers
      const now = new Date();
      const data: BarberSalaryData[] = barbers.map(barber => {
        const isFijo = barber.compensationType === 'fijo';
        
        // FILTERED values for display (change with period filter)
        let totalDevengado = devengadoFiltradoPorId[barber.id] || 0;
        const totalPagado = pagadoFiltradoPorId[barber.id] || 0;
        
        // For fixed salary: calculate proportional daily accrual
        let fixedSalaryInfo: BarberSalaryData['fixedSalaryInfo'] = undefined;
        if (isFijo && barber.fixedSalary) {
          const createdAt = barberCreatedAtMap[barber.id] ? new Date(barberCreatedAtMap[barber.id]) : now;
          const periodStart = periodStartDate || createdAt;
          const efectiveStart = isBefore(createdAt, periodStart) ? periodStart : createdAt;
          const efectiveEnd = periodEndDate ?? now;
          const devengadoFijo = calcularDevengadoFijo(barber.fixedSalary, efectiveStart, efectiveEnd);
          const dias = differenceInCalendarDays(efectiveEnd, efectiveStart);
          totalDevengado += devengadoFijo;
          fixedSalaryInfo = { sueldoFijo: barber.fixedSalary, dias: Math.max(0, dias), devengado: devengadoFijo };
        }

        // Comision extra por equipo (filtered)
        let comisionExtraEquipo: ComisionEquipoDetalle[] | undefined;
        const comisionData = comisionPorEncargado[barber.id];
        if (comisionData) {
          const filtrado = comisionData.filtrado;
          const entries = Object.entries(filtrado).filter(([, v]) => v.monto > 0);
          if (entries.length > 0) {
            comisionExtraEquipo = entries.map(([barberoOrigenId, v]) => ({
              barberoOrigenId,
              barberoOrigenNombre: v.nombre,
              porcentajeActual: v.porcentaje,
              montoTotal: v.monto,
            }));
            const totalComisionExtra = entries.reduce((sum, [, v]) => sum + v.monto, 0);
            totalDevengado += totalComisionExtra;
          }
        }

        // Bono fijo (filtered)
        let bonoFijoOcurrencias: BonoFijoOcurrencia[] | undefined;
        let bonoFijoTotal: number | undefined;
        const bonoFiltrado = bonoFiltradoPorId[barber.id];
        if (bonoFiltrado && bonoFiltrado.total > 0) {
          bonoFijoOcurrencias = bonoFiltrado.ocurrencias.sort((a, b) => a.fecha.localeCompare(b.fecha));
          bonoFijoTotal = bonoFiltrado.total;
          totalDevengado += bonoFijoTotal;
        }

        // Comisión por productos vendidos (filtered)
        const comisionProductosTotal = comisionProdFiltradoPorId[barber.id] || 0;
        if (comisionProductosTotal > 0) {
          totalDevengado += comisionProductosTotal;
        }
        // HISTORICAL saldo - real debt that NEVER changes with filter
        let saldoHistorico = (devengadoHistoricoPorId[barber.id] || 0) - (pagadoHistoricoPorId[barber.id] || 0);
        // For fixed salary: add historical accrual from created_at to now
        if (isFijo && barber.fixedSalary) {
          const createdAt = barberCreatedAtMap[barber.id] ? new Date(barberCreatedAtMap[barber.id]) : now;
          const devengadoHistoricoFijo = calcularDevengadoFijo(barber.fixedSalary, createdAt, now);
          saldoHistorico += devengadoHistoricoFijo;
        }
        // Add historical comision extra to saldo
        if (comisionData) {
          const totalHistorico = Object.values(comisionData.historico).reduce((sum, v) => sum + v.monto, 0);
          saldoHistorico += totalHistorico;
        }
        // Add historical comisión productos to saldo
        saldoHistorico += (comisionProdHistoricoPorId[barber.id] || 0);
        // Add historical bono fijo to saldo
        saldoHistorico += (bonoHistoricoPorId[barber.id] || 0);
        
        // Get detailed ingresos for this barber by barbero_id
        const detalleIngresos: IngresoDetalle[] = ((ingresosFiltrados || []) as IngresoRaw[])
          .filter(i => i.barbero_id === barber.id)
          .map(i => ({
            id: i.id,
            fecha: i.created_at,
            dia: i.dia || '',
            totalFacturado: Number(i.total_facturado) || 0,
            sueldo: Number(i.sueldo) || 0,
            efectivo: Number(i.efectivo) || 0,
            mp: Number(i.mp) || 0,
          }));

        // Get detailed pagos for this barber by barbero_id
        const detallePagos: PagoDetalle[] = (pagosFiltrados || [])
          .filter(p => p.barbero_id === barber.id)
          .map(p => ({
            id: p.id,
            fecha: p.created_at,
            monto: Number(p.monto) || 0,
            concepto: p.concepto,
          }));

        // Build display name for UI
        const nombreCompleto = `${barber.firstName.trim()} ${barber.lastName.trim()}`.replace(/\s+/g, ' ').trim();

        return {
          barberId: barber.id,
          barberName: nombreCompleto || barber.firstName.trim(),
          compensationType: barber.compensationType || 'comision',
          totalDevengado,
          totalPagado,
          saldo: saldoHistorico,  // Always historical
          detalleIngresos,
          detallePagos,
          fixedSalaryInfo,
          comisionExtraEquipo,
          bonoFijoOcurrencias,
          bonoFijoTotal,
          comisionProductosTotal,
        };
      });

      setSalaryData(data);
    } catch (error) {
      if (!request.current()) return;
      console.error('Error fetching salary data:', error);
      toast.error('Error al cargar datos de sueldos');
    } finally {
      if (request.current()) {
        setIsLoading(false);
        setHasLoadedOnce(true);
      }
      request.finish();
    }
  }, [organization, barbers, periodStartDate, periodEndDate, currentSucursal, enabled, access]);

  useEffect(() => {
    fetchData();
  }, [fetchData, periodStartDate, periodEndDate]);

  if (demo.active) {
    const inPeriod = (date: string) => (!periodStartDate || date.slice(0, 10) >= format(periodStartDate, 'yyyy-MM-dd')) && (!periodEndDate || date.slice(0, 10) <= format(periodEndDate, 'yyyy-MM-dd'));
    const filtered = demo.data.salaries.map(employee => {
      const detalleIngresos = employee.detalleIngresos.filter(row => inPeriod(row.fecha));
      const detallePagos = employee.detallePagos.filter(row => inPeriod(row.fecha));
      const totalDevengado = detalleIngresos.reduce((sum, row) => sum + row.sueldo, 0);
      return { ...employee, detalleIngresos, detallePagos, totalDevengado,
        totalPagado: detallePagos.reduce((sum, row) => sum + row.monto, 0),
        fixedSalaryInfo: employee.fixedSalaryInfo ? { ...employee.fixedSalaryInfo, dias: detalleIngresos.length, devengado: totalDevengado } : undefined,
      };
    });
    return { salaryData: filtered, pagos: demo.data.salaryPayments.filter(row => inPeriod(row.created_at)), isLoading: false, hasLoadedOnce: true, fetchData: async () => {} };
  }
  return { salaryData, pagos, isLoading, hasLoadedOnce, fetchData };
}
