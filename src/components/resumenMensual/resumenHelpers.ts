import type { Json } from '@/integrations/supabase/types';

/**
 * Modelo de lectura del resumen mensual automático.
 *
 * ⚠️ Este módulo SOLO lee lo que dejó pre-calculado el cron mensual
 * (public.generar_resumenes_mensuales()). No recalcula ninguna métrica:
 * las variaciones que se muestran salen de restar/dividir los valores que ya
 * vienen en la fila, y las de métodos de cobro salen del `var_pct` del jsonb.
 */

export type MetodoCobroKey = 'efectivo' | 'mercado_pago' | 'transferencia' | 'debito' | 'credito';

/**
 * Mapeo color↔método de cobro — ESPEJO del donut "Cómo se cobra" de
 * Estadísticas (EstadisticasPanel.tsx). Se reusa tal cual para que el mismo
 * método de pago tenga el mismo color en toda la app; si cambia allá, cambia acá.
 */
export const METODOS_COBRO: ReadonlyArray<{
  key: MetodoCobroKey;
  label: string;
  color: string;
}> = [
  { key: 'efectivo', label: 'Efectivo', color: 'hsl(var(--chart-cash))' },
  { key: 'mercado_pago', label: 'Mercado Pago', color: 'hsl(var(--chart-mp))' },
  { key: 'transferencia', label: 'Transferencia', color: 'hsl(var(--chart-cost))' },
  { key: 'debito', label: 'Débito', color: 'hsl(var(--chart-purple))' },
  { key: 'credito', label: 'Crédito', color: 'hsl(var(--chart-indigo))' },
];

/** Los 3 meses que compara cada tarjeta. `null` = el cron no tenía dato para ese mes. */
export interface SerieTresMeses {
  actual: number;
  mesAnterior: number | null;
  hace2Meses: number | null;
}

export interface MetodoCobroDato {
  key: MetodoCobroKey;
  label: string;
  color: string;
  actual: number;
  mesAnterior: number;
  /** Variación % vs. mes anterior, tal como la dejó el cron. `null` = sin base de comparación. */
  varPct: number | null;
}

export interface ResumenMensual {
  id: string;
  organizationId: string;
  sucursalId: string;
  sucursalNombre: string;
  /** Primer día del mes resumido, en hora local. */
  mes: Date;
  facturacion: SerieTresMeses;
  servicios: SerieTresMeses;
  rentabilidad: SerieTresMeses;
  metodos: MetodoCobroDato[];
}

/**
 * Parsea 'YYYY-MM-DD' como fecha LOCAL.
 * `new Date('2026-07-01')` se interpreta como UTC y en Argentina (UTC-3) cae
 * el 30 de junio, con lo cual el resumen de julio se etiquetaría "junio".
 */
export function parseMesLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** `numeric` de Postgres llega como string por PostgREST; `null` se preserva. */
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toNumber(value: unknown): number {
  return toNumberOrNull(value) ?? 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lee el jsonb `metodos_cobro`. Devuelve siempre los 5 métodos en el orden
 * canónico; los que falten en el json quedan en cero (sucursal sin cobros).
 */
export function parseMetodosCobro(raw: Json | null): MetodoCobroDato[] {
  const source = isRecord(raw) ? raw : {};
  return METODOS_COBRO.map(({ key, label, color }) => {
    const entry = isRecord(source[key]) ? (source[key] as Record<string, unknown>) : {};
    return {
      key,
      label,
      color,
      actual: toNumber(entry.actual),
      mesAnterior: toNumber(entry.mes_anterior),
      varPct: toNumberOrNull(entry.var_pct),
    };
  });
}

/**
 * Variación relativa en %. `null` cuando no hay base contra la cual comparar
 * (mes anterior sin dato o en cero) — en ese caso no se muestra pill.
 */
export function calcVarPct(actual: number, anterior: number | null): number | null {
  if (anterior === null || anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

/**
 * Variación en PUNTOS porcentuales, para métricas que ya son un porcentaje.
 * Rentabilidad de 79% a 50% es "-29,0 pts", no "-36,5%": el cambio relativo de
 * un porcentaje describe mal la caída y confunde al leerlo.
 */
export function calcVarPuntos(actual: number, anterior: number | null): number | null {
  if (anterior === null) return null;
  return actual - anterior;
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

const decimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatMoneda(value: number): string {
  return currencyFormatter.format(value);
}

/** Versión corta para las etiquetas de las barras, donde no entra el monto completo. */
export function formatMonedaCorta(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${decimalFormatter.format(value / 1_000_000)}M`;
  if (abs >= 10_000) return `$${integerFormatter.format(Math.round(value / 1000))}k`;
  return currencyFormatter.format(value);
}

export function formatEntero(value: number): string {
  return integerFormatter.format(value);
}

export function formatPorcentaje(value: number): string {
  return `${decimalFormatter.format(value)}%`;
}

/** "julio de 2026" — el mes que resume la historia. */
export function formatMesLargo(mes: Date): string {
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(mes);
}

/** "julio" — solo el nombre del mes, para las frases comparativas. */
export function formatMesNombre(mes: Date): string {
  return new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(mes);
}

/** "jul", "jun", "may" — etiquetas debajo de cada barra. Sin punto final. */
export function formatMesCorto(mes: Date): string {
  const label = new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(mes);
  return label.replace(/\.$/, '');
}

export function restarMeses(mes: Date, cantidad: number): Date {
  return new Date(mes.getFullYear(), mes.getMonth() - cantidad, 1);
}
