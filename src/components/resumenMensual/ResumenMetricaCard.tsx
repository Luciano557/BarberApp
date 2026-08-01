import type { LucideIcon } from 'lucide-react';
import { ComparativaMeses } from './ComparativaMeses';
import { VariacionPill } from './VariacionPill';
import { useValorAnimado } from './useValorAnimado';
import type { SerieTresMeses } from './resumenHelpers';

interface ResumenMetricaCardProps {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
  /** Valor crudo del mes resumido; el count-up lo recorre desde cero. */
  valorNumerico: number;
  /** Da formato al valor, tanto a los intermedios del count-up como al final. */
  formatValor: (valor: number) => string;
  variacion: number | null;
  unidadVariacion?: 'pct' | 'pts';
  serie: SerieTresMeses;
  mes: Date;
  /** Color sólido del token (barras + ícono). */
  color: string;
  /** El mismo token con alpha, para el fondo del ícono. */
  colorSuave: string;
  formatEtiqueta: (valor: number) => string;
  /** Una línea que traduce la variación a lenguaje llano. */
  narrativa: string;
}

export function ResumenMetricaCard({
  icono: Icono,
  titulo,
  descripcion,
  valorNumerico,
  formatValor,
  variacion,
  unidadVariacion = 'pct',
  serie,
  mes,
  color,
  colorSuave,
  formatEtiqueta,
  narrativa,
}: ResumenMetricaCardProps) {
  // Count-up desde cero hasta el valor del mes. `tabular-nums` en el <span> evita
  // que el número cambie de ancho mientras corre.
  const valorAnimado = useValorAnimado(0, valorNumerico);

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: colorSuave }}
        >
          <Icono className="h-5 w-5" style={{ color }} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          <p className="text-xs text-muted-foreground">{descripcion}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">
          {formatValor(valorAnimado)}
        </span>
        <VariacionPill valor={variacion} unidad={unidadVariacion} etiquetaSinDato="Sin comparación" />
      </div>

      <ComparativaMeses serie={serie} mes={mes} color={color} formatEtiqueta={formatEtiqueta} />

      <p className="mt-5 text-sm text-muted-foreground">{narrativa}</p>
    </div>
  );
}
