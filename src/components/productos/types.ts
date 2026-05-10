export interface Marca {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
}

export interface Producto {
  id: string;
  marca_id: string | null;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export type ComisionProductoModo = 'barbero' | 'ninguna' | 'personalizada';

export interface ProductoSucursal {
  id: string;
  producto_id: string;
  sucursal_id: string;
  activo: boolean;
  precio_costo: number | null;
  precio_venta: number;
  margen_pct: number | null;
  stock_actual: number;
  stock_minimo: number;
  comision_modo?: ComisionProductoModo;
  comision_porcentaje?: number | null;
}

export interface ProductoConSucursal {
  producto: Producto;
  marca: Marca | null;
  sucursal: ProductoSucursal | null; // null = no configurado en esta sucursal aún
}

export interface MovimientoStock {
  id: string;
  producto_sucursal_id: string;
  producto_id: string;
  sucursal_id: string;
  tipo: 'stock_inicial' | 'reposicion' | 'ajuste_manual' | 'venta';
  cantidad: number;
  stock_previo: number;
  stock_resultante: number;
  motivo: string | null;
  venta_id: string | null;
  created_by: string | null;
  created_at: string;
}

// Paleta sobria de colores para marcas (HSL tokens-friendly)
export const MARCA_COLORS: { name: string; value: string }[] = [
  { name: 'Pizarra', value: '#475569' },
  { name: 'Grafito', value: '#1f2937' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Índigo', value: '#4f46e5' },
  { name: 'Violeta', value: '#7c3aed' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Rojo', value: '#dc2626' },
  { name: 'Naranja', value: '#ea580c' },
  { name: 'Ámbar', value: '#d97706' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Esmeralda', value: '#059669' },
  { name: 'Cian', value: '#0891b2' },
];
