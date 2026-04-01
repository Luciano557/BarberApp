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

export interface Discount {
  id: string;
  label: string;
  value: number;
  type: 'percentage' | 'fixed'; // percentage = %, fixed = $
  rounding: 'cliente' | 'negocio' | 'matematico'; // cliente = floor, negocio = ceil, matematico = round
  roundingUnit: number; // unidad de redondeo (100, 500, 1000, etc.)
  paymentMethod: 'todos' | 'efectivo' | 'mercado_pago'; // restricción de método de pago
  sucursalId?: string; // Reference to sucursales table
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
  paymentMethod: 'efectivo' | 'mercado_pago';
  subtotal: number;
  total: number;
  createdAt: Date;
  // Soft delete fields
  estado?: 'activo' | 'anulado';
  anuladoAt?: Date;
  anuladoPor?: string;
  anuladoPorId?: string;
}

export type PaymentMethod = 'efectivo' | 'mercado_pago';
export type DiscountType = 'fixed' | 'percentage';
