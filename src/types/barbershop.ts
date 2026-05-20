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
  price: number; // Operativo: si hay sucursal, viene de servicios_sucursales.precio
  durationMin?: number; // Duration in minutes
  lineId?: string; // Reference to lineas table
  lineName?: string; // Cached line name for display
  sucursalId?: string; // Legacy / origen (no decide visibilidad)
  active: boolean; // Operativo: globalActive && branchActive cuando hay sucursal
  // Enriquecimiento por sucursal
  globalActive?: boolean; // servicios.activo
  branchActive?: boolean; // servicios_sucursales.activo
  sucursalConfigId?: string; // servicios_sucursales.id (para RPCs)
  priceConfigured?: boolean; // price > 0
}

export interface Extra {
  id: string;
  uid: string; // Auto-generated, unique, non-editable
  name: string;
  price: number; // Operativo: si hay sucursal, viene de extras_sucursales.precio
  sucursalId?: string; // Legacy / origen
  active: boolean; // Operativo: globalActive && branchActive cuando hay sucursal
  // Enriquecimiento por sucursal
  globalActive?: boolean; // extras.activo
  branchActive?: boolean; // extras_sucursales.activo
  sucursalConfigId?: string; // extras_sucursales.id (para RPCs)
  priceConfigured?: boolean; // price > 0
}

import type { AppRole } from '@/contexts/AuthContext';

export type CompensationType = 'comision' | 'fijo';
// Rol principal derivado del multirol (barberos.rol_equipo)
export type TeamRole = 'owner' | 'general_manager' | 'manager' | 'barbero' | 'otros';

export interface Barber {
  id: string;
  uid: string; // Auto-generated, unique, non-editable
  firstName: string;
  lastName: string;
  phone: string; // E.164 canónico (ej: '+5491125162528') o '' si no hay teléfono
  commission: number; // 0-100 percentage
  compensationType: CompensationType;
  fixedSalary?: number;
  teamRole: TeamRole; // compat: rol principal derivado (barberos.rol_equipo)
  rolesEquipo?: AppRole[]; // multirol operativo (barberos.roles_equipo)
  sucursalId?: string | null; // sucursal del integrante (barberos.sucursal_id)
  payDay?: number;
  address?: string;
  dni?: string;
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
  active: boolean; // Operativo: globalActive && branchActive cuando hay sucursal
  // Enriquecimiento por sucursal
  globalActive?: boolean; // descuentos.activo
  branchActive?: boolean; // descuentos_sucursales.activo
  sucursalConfigId?: string; // descuentos_sucursales.id (para RPC)
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

export interface TransactionProducto {
  producto_id: string;
  producto_sucursal_id?: string | null;
  producto_nombre: string;
  marca_id?: string | null;
  marca_nombre?: string | null;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

export interface Transaction {
  id: string;
  barberId: string | null;
  barberName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  servicePrice: number;
  extras: { uid: string; name: string; price: number }[];
  discount: number;
  discountType: 'fixed' | 'percentage';
  paymentMethod: PaymentMethod;
  payments?: TransactionPayment[];
  subtotal: number;
  total: number;            // BASE total de la venta (servicios + productos − descuentos)
  recargoTotal?: number;    // Suma de recargos cobrados
  totalCobrado?: number;    // total + recargoTotal (lo que entró a caja)
  // Separación servicio / producto para comisión
  tipoVenta?: 'servicio' | 'productos' | 'mixta';
  productosTotal?: number;  // Suma de subtotales de productos
  serviciosBase?: number;   // Base comisionable: total − productosTotal (0 si solo productos)
  serviceCount?: number;    // 1 si la venta tiene servicio, 0 si es solo productos
  productos?: TransactionProducto[];
  createdAt: Date;
  // Soft delete fields
  estado?: 'activo' | 'anulado';
  anuladoAt?: Date;
  anuladoPor?: string;
  anuladoPorId?: string;
}
