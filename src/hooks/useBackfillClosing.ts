import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { getEndOfDayLocal, getStartOfDayLocal } from '@/lib/dateUtils';
import { PaymentMethod } from '@/types/barbershop';

export interface BackfillServiceItem {
  servicioId: string;
  servicioNombre: string;
  lineaId: string | null;
  qty: number;
  unitPrice: number;
  paymentMethod: PaymentMethod;
}

export interface BackfillQuickData {
  amounts: Record<PaymentMethod, number>;
  cantidadServicios: number;
}

export interface BackfillData {
  barberId: string;
  barberName: string;
  commissionPct: number;
  date: Date;
  reason: string;
  note: string;
  mode: 'detailed' | 'quick';
  items: BackfillServiceItem[];
  quickData: BackfillQuickData | null;
  methodSurcharges: Record<PaymentMethod, number>;
}

export function useBackfillClosing() {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const { currentSucursal } = useSucursal();

  const saveBackfill = useCallback(async (data: BackfillData): Promise<boolean> => {
    if (!organization || !user) {
      toast.error('Error: No se encontró la organización o usuario');
      return false;
    }

    if (!currentSucursal) {
      toast.error('Seleccioná una sucursal antes de regularizar un día');
      return false;
    }

    const { barberId, barberName, commissionPct, date, reason, note, mode, items, quickData, methodSurcharges } = data;

    // Check for duplicate
    const tz = organization?.timezone || null;
    const startOfDay = getStartOfDayLocal(date, tz);
    const endOfDay = getEndOfDayLocal(date, tz);

    const { data: existing, error: checkError } = await supabase
      .from('ingresos')
      .select('id')
      .eq('barbero_id', barberId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .neq('estado', 'eliminado')
      .limit(1);

    if (checkError) {
      console.error('Error checking duplicates:', checkError);
      toast.error('Error al verificar cierres existentes');
      return false;
    }

    if (existing && existing.length > 0) {
      toast.error(`Ya existe un cierre para ${barberName} en esta fecha`);
      return false;
    }

    // Calculate totals — mirrors useCashClosing.ts bucketing convention
    // efectivo → efectivoBase/Cobrado; everything else → mpBase/digitalCobrado
    let efectivoBase = 0, mpBase = 0;
    let efectivoCobrado = 0, digitalCobrado = 0;
    let recargosTotal = 0;
    let cantidadDeServicios = 0;

    if (mode === 'detailed') {
      items.forEach(item => {
        const base = item.qty * item.unitPrice;
        const recargoPct = methodSurcharges[item.paymentMethod] ?? 0;
        const recargoMonto = Math.round(base * recargoPct / 100);
        recargosTotal += recargoMonto;
        cantidadDeServicios += item.qty;
        if (item.paymentMethod === 'efectivo') {
          efectivoBase += base;
          efectivoCobrado += base + recargoMonto;
        } else {
          mpBase += base;
          digitalCobrado += base + recargoMonto;
        }
      });
    } else if (quickData) {
      // D1: usuario ingresa COBRADO → deducimos BASE (base = round(cobrado * 100 / (100 + pct)))
      Object.entries(quickData.amounts).forEach(([method, cobrado]) => {
        if (!cobrado || cobrado === 0) return;
        const recargoPct = methodSurcharges[method as PaymentMethod] ?? 0;
        const base = recargoPct > 0
          ? Math.round(cobrado * 100 / (100 + recargoPct))
          : cobrado;
        const recargoMonto = cobrado - base;
        recargosTotal += recargoMonto;
        if (method === 'efectivo') {
          efectivoBase += base;
          efectivoCobrado += cobrado;
        } else {
          mpBase += base;
          digitalCobrado += cobrado;
        }
      });
      cantidadDeServicios = quickData.cantidadServicios;
    }

    const totalFacturado = efectivoBase + mpBase;           // BASE — comisionable
    const totalCobrado = efectivoCobrado + digitalCobrado;  // real cobrado con recargos
    const sueldo = Math.round(totalFacturado * (commissionPct / 100)); // SIEMPRE sobre BASE
    const dia = format(date, 'EEEE', { locale: es });
    const identificador = crypto.randomUUID();

    const insertData = {
      barbero: barberName,
      barbero_id: barberId,
      mp: mpBase,
      efectivo: efectivoBase,
      total_facturado: totalFacturado,
      total_sin_descuento: totalFacturado,
      perdida: 0,
      cantidad_de_servicios: cantidadDeServicios,
      servicios_con_descuento: 0,
      servicios_sin_descuento: cantidadDeServicios,
      cantidad_de_50_por: 0,
      cantidad_de_20_por: 0,
      dia,
      sueldo,
      extras: 0,
      identificador,
      estado: 'activo',
      Usuario: 'Sistema',
      servicios_por_linea: {},
      created_at: getEndOfDayLocal(date, tz),
      closed_at: new Date().toISOString(),
      organization_id: organization.id,
      sucursal_id: currentSucursal.id,
      entry_mode: 'diferido',
      backfilled_at: new Date().toISOString(),
      backfilled_by: user.id,
      backfill_reason: reason,
      backfill_note: note || null,
      recargos_total: recargosTotal,
      total_cobrado: totalCobrado,
      efectivo_cobrado: efectivoCobrado,
      digital_cobrado: digitalCobrado,
    };

    const { data: insertedIngreso, error: insertError } = await supabase
      .from('ingresos')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      console.error('Error saving backfill:', insertError);
      toast.error('Error al guardar el cierre diferido');
      return false;
    }

    // Save detailed items if mode is detailed
    if (mode === 'detailed' && items.length > 0 && insertedIngreso) {
      const itemsToInsert = items
        .filter(item => item.qty > 0)
        .map(item => ({
          organization_id: organization.id,
          ingreso_id: insertedIngreso.id,
          barbero_id: barberId,
          servicio_id: item.servicioId || null,
          linea_id: item.lineaId || null,
          servicio_nombre: item.servicioNombre,
          payment_method: item.paymentMethod,
          qty: item.qty,
          unit_price: item.unitPrice,
          subtotal: item.qty * item.unitPrice,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('ingresos_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Error saving backfill items:', itemsError);
          // Non-fatal: the main record was saved
        }
      }
    }

    toast.success(`Cierre diferido guardado para ${barberName}`);
    return true;
  }, [organization, user, currentSucursal]);

  return { saveBackfill };
}
