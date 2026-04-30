export interface Line {
  id: string;
  name: string;
  color?: string;
  active: boolean;
}

export interface Service {
  id: string;
  uid: string; // Auto-generated, unique, non-editable
  name: string;
  price: number;
  durationMin?: number; // Duration in minutes
  lineId?: string; // Reference to lineas table
  lineName?: string; // Cached line name for display
  sucursalId?: string; // Reference to sucursales table
  active: boolean;
}

export interface Extra {
  id: string;
  uid: string; // Auto-generated, unique, non-editable
  name: string;
  price: number;
  sucursalId?: string; // Reference to sucursales table
  active: boolean;
}

export type CompensationType = 'comision' | 'fijo';
export type TeamRole = 'barbero' | 'otros';

export interface Barber {
  id: string;
  uid: string; // Auto-generated, unique, non-editable
  firstName: string;
  lastName: string;
  phone: string;
  commission: number; // 0-100 percentage
  compensationType: CompensationType; // 'comision' = variable, 'fijo' = fixed salary
  fixedSalary?: number; // Monthly fixed salary when compensationType = 'fijo'
  teamRole: TeamRole; // 'barbero' = operational (can receive services), 'otros' = non-operational
  payDay?: number; // Day of month for fixed salary payment (1-28)
  address?: string; // Optional
  dni?: string; // Optional
  active: boolean;
}

// Helper to get display name
export function getBarberDisplayName(barber: Barber): string {
  return `${barber.firstName} ${barber.lastName}`.trim();
}

export type DiscountAppliesTo = 'servicios' | 'productos';

export interface Discount {
  id: string;
  label: string;
  value: number;
  type: 'percentage' | 'fixed'; // percentage = %, fixed = $
  rounding: 'cliente' | 'negocio' | 'matematico'; // cliente = floor, negocio = ceil, matematico = round
  roundingUnit: number; // unidad de redondeo (100, 500, 1000, etc.)
  paymentMethod: 'todos' | 'efectivo' | 'mercado_pago'; // restricción de método de pago
  sucursalId?: string; // Reference to sucursales table (origen, no decide visibilidad)
  appliesTo: DiscountAppliesTo; // 'servicios' | 'productos'
  active: boolean; // descuentos.activo (estado global)
}

// Snapshot de un descuento aplicado a una venta (auditoría)
export interface AppliedDiscountSnapshot {
  descuentoId: string | null;
  descuentoNombre: string;
  descuentoTipo: 'porcentaje' | 'monto';
  descuentoValor: number;
  descuentoAplicaA: DiscountAppliesTo;
  subtotalBase: number;
  montoAplicado: number;
}

export type PaymentMethod = 'efectivo' | 'mercado_pago' | 'transferencia' | 'debito' | 'credito';
export type DiscountType = 'fixed' | 'percentage';

// Métodos de pago: lista cerrada e identidad visual
export const PAYMENT_METHODS: PaymentMethod[] = ['efectivo', 'mercado_pago', 'transferencia', 'debito', 'credito'];

export function getMethodLabel(m: PaymentMethod): string {
  switch (m) {
    case 'efectivo': return 'Efectivo';
    case 'mercado_pago': return 'QR';
    case 'transferencia': return 'Transferencia';
    case 'debito': return 'Débito';
    case 'credito': return 'Crédito';
  }
}

// Métodos electrónicos (todo lo que no es efectivo)
export function isDigitalMethod(m: PaymentMethod): boolean {
  return m !== 'efectivo';
}

export interface TransactionPayment {
  method: PaymentMethod;
  amount: number;          // base + recargo (lo que entra a caja)
  recargoPct?: number;     // % aplicado a la base de este pago
  recargoMonto?: number;   // recargo en pesos de este pago
  basePago?: number;       // porción de BASE asignada a este pago
}

export interface Transaction {
  id: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  extras: { uid: string; name: string; price: number }[];
  discount: number;
  discountType: 'fixed' | 'percentage';
  paymentMethod: PaymentMethod;
  payments?: TransactionPayment[];
  subtotal: number;
  total: number;            // BASE comisionable (servicio + extras − descuento)
  recargoTotal?: number;    // Suma de recargos cobrados
  totalCobrado?: number;    // total + recargoTotal (lo que entró a caja)
  createdAt: Date;
  // Soft delete fields
  estado?: 'activo' | 'anulado';
  anuladoAt?: Date;
  anuladoPor?: string;
  anuladoPorId?: string;
}
