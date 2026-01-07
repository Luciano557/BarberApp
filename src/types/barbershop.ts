export interface Service {
  id: string;
  name: string;
  price: number;
}

export interface Extra {
  id: string;
  name: string;
  price: number;
}

export interface Barber {
  id: string;
  name: string;
  active: boolean;
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
  extras: { id: string; name: string; price: number }[];
  discount: number;
  discountType: 'fixed' | 'percentage';
  paymentMethod: 'efectivo' | 'mercado_pago';
  subtotal: number;
  total: number;
  createdAt: Date;
}

export type PaymentMethod = 'efectivo' | 'mercado_pago';
export type DiscountType = 'fixed' | 'percentage';
