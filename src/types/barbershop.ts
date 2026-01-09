export interface Line {
  id: string;
  name: string;
  active: boolean;
}

export interface Service {
  id: string;
  uid: string; // Auto-generated, unique, non-editable
  name: string;
  price: number;
  active: boolean;
  lineId?: string; // Reference to Line
}

export interface Extra {
  id: string;
  uid: string; // Auto-generated, unique, non-editable
  name: string;
  price: number;
  active: boolean;
}

export interface Barber {
  id: string;
  uid: string; // Auto-generated, unique, non-editable
  firstName: string;
  lastName: string;
  phone: string;
  commission: number; // 0-100 percentage
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
}

export type PaymentMethod = 'efectivo' | 'mercado_pago';
export type DiscountType = 'fixed' | 'percentage';
