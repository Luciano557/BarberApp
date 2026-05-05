import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, Line, PaymentMethod } from '@/types/barbershop';
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
  productosTotal?: number;
  serviciosBase?: number;
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
        : [{ method: tx.paymentMethod, amount: tx.total, basePago: tx.total, recargoPct: 0, recargoMonto: 0 }];

    // BASE (legacy): se calcula sobre basePago de cada pago.
    // efectivo / mp siguen siendo BASE (no incluyen recargo) — lógica histórica intacta.
    let mpBase = 0;
    let efectivoBase = 0;
    // Snapshot real cobrado (incluye recargos)
    let efectivoCobrado = 0;
    let digitalCobrado = 0;
    let recargosTotal = 0;

    barberTxs.forEach(tx => {
      txPayments(tx).forEach(p => {
        const basePago = p.basePago != null ? p.basePago : p.amount;
        const recargoMonto = p.recargoMonto ?? 0;
        const cobrado = basePago + recargoMonto;
        recargosTotal += recargoMonto;

        if (p.method === 'efectivo') {
          efectivoBase += basePago;
          efectivoCobrado += cobrado;
        } else {
          // mercado_pago, transferencia, debito, credito → digital
          // Para campo legacy `mp` mantenemos sólo BASE (independiente del método electrónico).
          mpBase += basePago;
          digitalCobrado += cobrado;
        }
      });
    });

    const totalFacturado = mpBase + efectivoBase;        // BASE total — sin recargos
    const totalCobrado = efectivoCobrado + digitalCobrado; // Real cobrado — con recargos

    // Calculate what would have been charged without discounts
    const totalSinDescuento = barberTxs.reduce((sum, tx) => {
      const extrasTotal = tx.extras.reduce((s, e) => s + e.price, 0);
      return sum + tx.servicePrice + extrasTotal;
    }, 0);

    const perdida = totalSinDescuento - totalFacturado;

    // Count services with/without discount (solo ventas con servicio)
    const txsConServicio = barberTxs.filter(tx => (tx.serviceCount ?? (tx.tipoVenta === 'productos' || !tx.serviceId ? 0 : 1)) > 0);
    const serviciosConDescuento = txsConServicio.filter(tx => tx.discount > 0).length;
    const serviciosSinDescuento = txsConServicio.filter(tx => tx.discount === 0).length;
    const cantidadDeServicios = barberTxs.reduce(
      (s, tx) => s + (tx.serviceCount ?? (tx.tipoVenta === 'productos' || !tx.serviceId ? 0 : 1)),
      0
    );

    // Count by discount percentage
    const cantidadDe50Por = txsConServicio.filter(tx => tx.discount === 50).length;
    const cantidadDe20Por = txsConServicio.filter(tx => tx.discount === 20).length;

    // Count extras
    const extras = barberTxs.reduce((sum, tx) => sum + tx.extras.length, 0);

    // Day of week in Spanish
    const dia = format(date, 'EEEE', { locale: es });

    // Base comisionable (sólo servicios) y agregados de productos
    const serviciosBase = barberTxs.reduce(
      (s, tx) => s + (tx.serviciosBase ?? (tx.tipoVenta === 'productos' ? 0 : tx.total)),
      0
    );
    const productosTotal = barberTxs.reduce((s, tx) => s + (tx.productosTotal ?? 0), 0);
    const productosCantidad = barberTxs.reduce(
      (s, tx) => s + (tx.productos?.reduce((acc, p) => acc + (p.cantidad || 0), 0) ?? 0),
      0
    );

    // Prorratear productos por método (efectivo/digital) según basePago de cada venta
    let productosEfectivo = 0;
    let productosDigital = 0;
    barberTxs.forEach(tx => {
      const txProdTotal = tx.productosTotal ?? 0;
      if (txProdTotal <= 0) return;
      const pagos = txPayments(tx);
      const sumBase = pagos.reduce((s, p) => s + (p.basePago != null ? p.basePago : p.amount), 0);
      if (sumBase <= 0) {
        productosEfectivo += txProdTotal;
        return;
      }
      let efAcc = 0;
      let digAcc = 0;
      pagos.forEach(p => {
        const base = p.basePago != null ? p.basePago : p.amount;
        const share = (base / sumBase) * txProdTotal;
        if (p.method === 'efectivo') efAcc += share;
        else digAcc += share;
      });
      productosEfectivo += Math.round(efAcc);
      productosDigital += Math.round(digAcc);
    });

    // Recalcular sueldo SIEMPRE desde serviciosBase (no usar barber.commissionAmount)
    const sueldo = Math.round(serviciosBase * (barber.commissionPct / 100));

    // Count services by line (sólo ventas con servicio)
    const serviciosPorLinea: Record<string, number> = {};
    lines.forEach(line => {
      serviciosPorLinea[line.name] = 0;
    });

    txsConServicio.forEach(tx => {
      const name = tx.serviceName || '';
      const matchedLine = lines.find(line =>
        name.toLowerCase().includes(line.name.toLowerCase())
      );
      if (matchedLine) {
        serviciosPorLinea[matchedLine.name] = (serviciosPorLinea[matchedLine.name] || 0) + 1;
      } else {
        serviciosPorLinea['Sin línea'] = (serviciosPorLinea['Sin línea'] || 0) + 1;
      }
    });

    // Generate unique identifier for this day/barber combo
    const identificador = crypto.randomUUID();

    // Prepare the insert data with barbero_id (UUID) as source of truth
    const insertData = {
      barbero: normalizedBarberName,
      barbero_id: barber.barberId,
      mp: mpBase,
      efectivo: efectivoBase,
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
      recargos_total: recargosTotal,
      total_cobrado: totalCobrado,
      efectivo_cobrado: efectivoCobrado,
      digital_cobrado: digitalCobrado,
      productos_total: productosTotal,
      productos_cantidad: productosCantidad,
      productos_efectivo: productosEfectivo,
      productos_digital: productosDigital,
    };

    const { data: ingreso, error } = await supabase
      .from('ingresos')
      .insert(insertData as any)
      .select('id')
      .single();

    if (error || !ingreso) {
      console.error('Error saving cash closing:', error);
      toast.error('Error al guardar el cierre de caja');
      return false;
    }

    // Insertar productos vendidos del barbero en ingresos_items_productos
    const productosRows: any[] = [];
    barberTxs.forEach(tx => {
      if (!tx.productos || tx.productos.length === 0) return;
      const pagos = txPayments(tx);
      const dominante = [...pagos].sort((a, b) => b.amount - a.amount)[0];
      const paymentMethod = dominante?.method === 'efectivo' ? 'efectivo' : 'digital';
      tx.productos.forEach(p => {
        productosRows.push({
          ingreso_id: ingreso.id,
          organization_id: organization.id,
          sucursal_id: currentSucursal?.id || null,
          barbero_id: barber.barberId,
          producto_id: p.producto_id,
          producto_nombre: p.producto_nombre,
          marca_id: p.marca_id ?? null,
          marca_nombre: p.marca_nombre ?? null,
          qty: p.cantidad,
          unit_price: p.precio_unitario,
          subtotal: p.subtotal,
          payment_method: paymentMethod,
        });
      });
    });

    if (productosRows.length > 0) {
      const { error: prodErr } = await supabase
        .from('ingresos_items_productos')
        .insert(productosRows as any);
      if (prodErr) {
        console.error('Error saving ingresos_items_productos:', prodErr);
      }
    }

    toast.success(`Cierre de caja guardado para ${normalizedBarberName}`);
    return true;
  }, [organization, currentSucursal]);
  
  return { saveCashClosing };
}
