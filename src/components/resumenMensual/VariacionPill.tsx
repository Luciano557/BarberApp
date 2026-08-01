import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';

/** Debajo de este valor absoluto la variación se considera "sin cambios". */
const UMBRAL_SIN_CAMBIO = 0.05;

const formatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface VariacionPillProps {
  /** Variación vs. mes anterior. `null` = no hay base contra la cual comparar. */
  valor: number | null;
  /**
   * `pct` → "+15,1%" para montos y cantidades.
   * `pts` → "+2,4 pts" para métricas que YA son un porcentaje: pasar de 79% a
   * 50% es una caída de 29 puntos, no de 36,5%.
   */
  unidad?: 'pct' | 'pts';
  /** Si se pasa, con `valor` nulo se muestra este texto en gris en vez de nada. */
  etiquetaSinDato?: string;
  size?: 'sm' | 'md';
}

export function VariacionPill({
  valor,
  unidad = 'pct',
  etiquetaSinDato,
  size = 'md',
}: VariacionPillProps) {
  if (valor === null) {
    if (!etiquetaSinDato) return null;
    return <StatusPill status="neutral" label={etiquetaSinDato} icon={false} size={size} />;
  }

  const sinCambio = Math.abs(valor) < UMBRAL_SIN_CAMBIO;
  const sube = !sinCambio && valor > 0;
  const sufijo = unidad === 'pts' ? ' pts' : '%';
  const signo = sinCambio ? '' : sube ? '+' : '−';
  const label = `${signo}${formatter.format(Math.abs(valor))}${sufijo}`;

  return (
    <StatusPill
      status={sinCambio ? 'neutral' : sube ? 'success' : 'error'}
      label={label}
      icon={sinCambio ? Minus : sube ? ArrowUpRight : ArrowDownRight}
      size={size}
    />
  );
}
