import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, Line } from '@/types/barbershop';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BarberSummary {
  barberId: string;
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
  const saveCashClosing = useCallback(async (data: CashClosingData) => {
    const { barber, transactions, date, lines } = data;
    
    // Filter transactions for this barber
    const barberTxs = transactions.filter(tx => tx.barberId === barber.barberId);
    
    // Calculate totals
    const mp = barberTxs
      .filter(tx => tx.paymentMethod === 'mercado_pago')
      .reduce((sum, tx) => sum + tx.total, 0);
    
    const efectivo = barberTxs
      .filter(tx => tx.paymentMethod === 'efectivo')
      .reduce((sum, tx) => sum + tx.total, 0);
    
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
    
    // Prepare the insert data
    const insertData = {
      barbero: barber.barberName,
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
      Usuario: 'Sistema', // TODO: Replace with actual user when auth is implemented
      servicios_por_linea: serviciosPorLinea,
      created_at: new Date().toISOString(),
    };
    
    const { error } = await supabase
      .from('ingresos')
      .insert(insertData);
    
    if (error) {
      console.error('Error saving cash closing:', error);
      toast.error('Error al guardar el cierre de caja');
      return false;
    }
    
    toast.success(`Cierre de caja guardado para ${barber.barberName}`);
    return true;
  }, []);
  
  return { saveCashClosing };
}
