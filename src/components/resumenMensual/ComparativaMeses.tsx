import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { formatMesCorto, restarMeses, type SerieTresMeses } from './resumenHelpers';

/** Opacidad de cada barra: el pasado se apaga y el mes resumido queda a pleno. */
const OPACIDADES = [0.28, 0.5, 1];

interface ComparativaMesesProps {
  serie: SerieTresMeses;
  /** Mes resumido; los otros dos se derivan restando 1 y 2 meses. */
  mes: Date;
  /** Color de las barras (mismo token que el resto de la tarjeta). */
  color: string;
  /** Etiqueta corta arriba de cada barra. */
  formatEtiqueta: (valor: number) => string;
}

export function ComparativaMeses({ serie, mes, color, formatEtiqueta }: ComparativaMesesProps) {
  const prefiereMenosMovimiento = usePrefersReducedMotion();

  const columnas = [
    { mes: restarMeses(mes, 2), valor: serie.hace2Meses },
    { mes: restarMeses(mes, 1), valor: serie.mesAnterior },
    { mes, valor: serie.actual },
  ];

  const valores = columnas.map(c => c.valor).filter((v): v is number => v !== null);
  const techo = Math.max(0, ...valores);
  const piso = Math.min(0, ...valores);
  const rango = techo - piso;
  const hayDatos = valores.length > 0 && rango > 0;
  // Con valores negativos hace falta una línea de cero para leer las barras.
  const hayNegativos = hayDatos && piso < 0;
  const fraccionCero = hayDatos ? (0 - piso) / rango : 0;

  return (
    <div className="mt-5">
      {/* Ancho acotado y centrado: a lo ancho de la tarjeta las tres barras
          quedan tan separadas que dejan de leerse como una comparación. */}
      <div className="mx-auto max-w-[264px]">
        <div className="grid grid-cols-3 gap-4">
          {columnas.map((columna, i) => (
            <span
              key={columna.mes.getTime()}
              className={cn(
                'truncate text-center text-xs tabular-nums',
                i === columnas.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {columna.valor === null ? '—' : formatEtiqueta(columna.valor)}
            </span>
          ))}
        </div>

        {/* Las pistas viven en una fila propia para que la línea de cero pueda
            cruzar el gráfico entero de un trazo, y no cortada columna a columna. */}
        <div className="relative mt-2 grid h-28 grid-cols-3 gap-4">
          {hayNegativos && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-dashed border-border"
              style={{ bottom: `${fraccionCero * 100}%` }}
            />
          )}

          {columnas.map((columna, i) => {
            const valor = columna.valor;
            if (valor === null) return <div key={columna.mes.getTime()} className="relative" />;

            const base = hayDatos ? (Math.min(valor, 0) - piso) / rango : 0;
            const alto = hayDatos ? Math.abs(valor) / rango : 0;

            return (
              <div key={columna.mes.getTime()} className="relative">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-x-0 mx-auto w-full max-w-[64px]',
                    valor >= 0 ? 'rounded-t-[3px]' : 'rounded-b-[3px]',
                    !prefiereMenosMovimiento && 'animate-resumen-bar-in',
                  )}
                  style={{
                    bottom: `${base * 100}%`,
                    height: `${alto * 100}%`,
                    minHeight: '2px',
                    backgroundColor: color,
                    opacity: OPACIDADES[i],
                    transformOrigin: valor >= 0 ? 'bottom' : 'top',
                    animationDelay: `${i * 70}ms`,
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-4">
          {columnas.map((columna, i) => (
            <span
              key={columna.mes.getTime()}
              className={cn(
                'text-center text-[11px] capitalize',
                i === columnas.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {formatMesCorto(columna.mes)}
            </span>
          ))}
        </div>
      </div>

      {!hayDatos && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Sin actividad registrada en estos tres meses.
        </p>
      )}
    </div>
  );
}
