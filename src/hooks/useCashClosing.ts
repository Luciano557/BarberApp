import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, Line } from '@/types/barbershop';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { getStartOfDayLocal, getEndOfDayLocal } from '@/lib/dateUtils';

interface BarberSummary {
  barberId: string;  // UUID del barbero
  barberName: string;
  count: number;
  totalEfectivo: number;
  totalMercadoPago: number;
  total: number;
  commissionPct: number;
  commissionAmount: number;
}

interface CashClosingData {
  barber: BarberSummary;
  transactions: Transaction[];
  date: Date;
  lines: Line[];
}

export function useCashClosing() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();

  const saveCashClosing = useCallback(async (data: CashClosingData) => {
    if (!organization) {
      toast.error('Error: No se encontró la organización');
      return false;
    }

    const { barber, transactions, date, lines } = data;
    
    // Normalize barber name to avoid spacing issues
    const normalizedBarberName = barber.barberName.replace(/\s+/g, ' ').trim();
    
    // Check for duplicate closing on same date for same barber
    // Usar funciones de fecha consistentes con timezone
    const tz = organization?.timezone || null;
    const startOfDay = getStartOfDayLocal(date, tz);
    const endOfDay = getEndOfDayLocal(date, tz);
    
    // Validar duplicados por barbero_id (UUID) - más confiable que texto
    const { data: existingClosing, error: checkError } = await supabase
      .from('ingresos')
      .select('id')
      .eq('barbero_id', barber.barberId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .neq('estado', 'eliminado')
      .limit(1);
    
    if (checkError) {
      console.error('Error checking for duplicates:', checkError);
      toast.error('Error al verificar cierres existentes');
      return false;
    }
    
    if (existingClosing && existingClosing.length > 0) {
      toast.error(`Ya existe un cierre de caja para ${normalizedBarberName} en esta fecha`);
      return false;
    }
    
    // Filter transactions for this barber (only active)
    const barberTxs = transactions.filter(tx => tx.barberId === barber.barberId && tx.estado !== 'anulado');
    
    // Helper to read payments for a tx (with legacy fallback)
    const txPayments = (tx: typeof barberTxs[number]) =>
      tx.payments && tx.payments.length > 0
        ? tx.payments
        : [{ method: tx.paymentMethod, amount: tx.total }];

    // Calculate totals using payments array (supports mixed payments)
    let mp = 0;
    let efectivo = 0;
    barberTxs.forEach(tx => {
      txPayments(tx).forEach(p => {
        if (p.method === 'mercado_pago') mp += p.amount;
        else if (p.method === 'efectivo') efectivo += p.amount;
      });
    });
    
    const totalFacturado = mp + efectivo;
    
    // Calculate what would have been charged without discounts
    const totalSinDescuento = barberTxs.reduce((sum, tx) => {
      const extrasTotal = tx.extras.reduce((s, e) => s + e.price, 0);
      return sum + tx.servicePrice + extrasTotal;
    }, 0);
    
    const perdida = totalSinDescuento - totalFacturado;
    
    // Count services with/without discount
    const serviciosConDescuento = barberTxs.filter(tx => tx.discount > 0).length;
    const serviciosSinDescuento = barberTxs.filter(tx => tx.discount === 0).length;
    const cantidadDeServicios = barberTxs.length;
    
    // Count by discount percentage
    const cantidadDe50Por = barberTxs.filter(tx => tx.discount === 50).length;
    const cantidadDe20Por = barberTxs.filter(tx => tx.discount === 20).length;
    
    // Count extras
    const extras = barberTxs.reduce((sum, tx) => sum + tx.extras.length, 0);
    
    // Day of week in Spanish
    const dia = format(date, 'EEEE', { locale: es });
    
    // Calculate salary (commission)
    const sueldo = barber.commissionAmount;
    
    // Count services by line
    const serviciosPorLinea: Record<string, number> = {};
    lines.forEach(line => {
      serviciosPorLinea[line.name] = 0;
    });
    
    // We need to get line info from the service - check if serviceName contains line info
    // Since we store serviceName but not lineId in transactions, we'll need to match by service
    barberTxs.forEach(tx => {
      // Try to find line from the service name pattern or from stored lineId
      // For now, we'll use a simplified approach - check against known line names
      const matchedLine = lines.find(line => 
        tx.serviceName.toLowerCase().includes(line.name.toLowerCase())
      );
      if (matchedLine) {
        serviciosPorLinea[matchedLine.name] = (serviciosPorLinea[matchedLine.name] || 0) + 1;
      } else {
        // Count as "Sin línea" if no match
        serviciosPorLinea['Sin línea'] = (serviciosPorLinea['Sin línea'] || 0) + 1;
      }
    });
    
    // Generate unique identifier for this day/barber combo
    const identificador = crypto.randomUUID();
    
    // Prepare the insert data with barbero_id (UUID) as source of truth
    const insertData = {
      barbero: normalizedBarberName,  // Mantener para display
      barbero_id: barber.barberId,    // UUID - fuente de verdad para relaciones
      mp,
      efectivo,
      total_facturado: totalFacturado,
      total_sin_descuento: totalSinDescuento,
      perdida,
      cantidad_de_servicios: cantidadDeServicios,
      servicios_con_descuento: serviciosConDescuento,
      servicios_sin_descuento: serviciosSinDescuento,
      cantidad_de_50_por: cantidadDe50Por,
      cantidad_de_20_por: cantidadDe20Por,
      dia,
      sueldo,
      extras,
      identificador,
      estado: 'activo',
      Usuario: 'Sistema',
      servicios_por_linea: serviciosPorLinea,
      created_at: getEndOfDayLocal(date, tz),
      closed_at: new Date().toISOString(),
      organization_id: organization.id,
      sucursal_id: currentSucursal?.id || null,
    };
    
    const { error } = await supabase
      .from('ingresos')
      .insert(insertData);
    
    if (error) {
      console.error('Error saving cash closing:', error);
      toast.error('Error al guardar el cierre de caja');
      return false;
    }
    
    toast.success(`Cierre de caja guardado para ${normalizedBarberName}`);
    return true;
  }, [organization, currentSucursal]);
  
  return { saveCashClosing };
}
