import { Wallet } from 'lucide-react';
import { Cell, Pie, PieChart } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { VariacionPill } from './VariacionPill';
import { useValorAnimado } from './useValorAnimado';
import { formatMoneda, type MetodoCobroDato } from './resumenHelpers';

/** El anillo arranca a las 12 y barre en sentido horario (90° → -270°). */
const ANGULO_INICIO = 90;
const ANGULO_FIN = -270;
const DURACION_BARRIDO_MS = 800;

const porcentajeFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface ResumenMetodosCardProps {
  metodos: MetodoCobroDato[];
  /** Mes resumido, en texto ("julio de 2026"). */
  mesLabel: string;
}

export function ResumenMetodosCard({ metodos, mesLabel }: ResumenMetodosCardProps) {
  // Un método que no se usó ni este mes ni el anterior no aporta nada a la
  // lectura; uno que cayó a cero sí, porque explica su propia variación.
  const visibles = metodos.filter(m => m.actual > 0 || m.mesAnterior > 0);
  const total = metodos.reduce((suma, m) => suma + m.actual, 0);
  const porciones = visibles.filter(m => m.actual > 0);
  const hayDatos = total > 0;

  // El barrido se maneja acá y no con la animación interna de recharts: sus
  // defaults son 400ms de espera + 1500ms con easing 'ease', y `animationEasing`
  // solo acepta palabras clave, así que no hay forma de pedirle --ease-out-quint.
  // Con `isAnimationActive={false}` recharts no compite con este ángulo.
  const anguloFin = useValorAnimado(ANGULO_INICIO, ANGULO_FIN, DURACION_BARRIDO_MS);
  const totalAnimado = useValorAnimado(0, total);

  const config = Object.fromEntries(
    visibles.map(m => [m.key, { label: m.label, color: m.color }]),
  );

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tile"
          style={{ backgroundColor: 'hsl(var(--primary) / 0.1)' }}
        >
          <Wallet className="h-5 w-5 text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Métodos de cobro</h3>
          <p className="text-xs text-muted-foreground">Cómo se cobró en {mesLabel}.</p>
        </div>
      </div>

      {!hayDatos ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No se registraron cobros en {mesLabel}.
        </p>
      ) : (
        <>
          <div className="relative mx-auto mt-5 h-48 w-48">
            <ChartContainer config={config} className="aspect-square h-48 w-48" aria-hidden="true">
              <PieChart>
                <Pie
                  data={porciones}
                  dataKey="actual"
                  nameKey="label"
                  innerRadius="66%"
                  outerRadius="92%"
                  startAngle={ANGULO_INICIO}
                  endAngle={anguloFin}
                  isAnimationActive={false}
                >
                  {/* Los gajos se separan con un trazo del color de la tarjeta y no con
                      `paddingAngle`: con porciones muy chicas (un método con el 0,4%) el
                      padding es más grande que el gajo y lo dibuja despegado del anillo. */}
                  {porciones.map(porcion => (
                    <Cell
                      key={porcion.key}
                      fill={porcion.color}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <span className="text-base font-semibold tabular-nums text-foreground">
                {formatMoneda(totalAnimado)}
              </span>
              <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                Cobros registrados
              </span>
            </div>
          </div>

          <ul className="mt-6 space-y-2.5">
            {visibles.map(metodo => (
              <li key={metodo.key} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: metodo.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{metodo.label}</span>
                <span className="shrink-0 text-sm tabular-nums text-foreground">
                  {formatMoneda(metodo.actual)}
                </span>
                {/* En mobile la proporción se cede al donut: sin esta columna el
                    nombre del método entra completo en vez de truncarse. */}
                <span className="hidden w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
                  {porcentajeFormatter.format((metodo.actual / total) * 100)}%
                </span>
                <span className="flex w-[72px] shrink-0 justify-end">
                  <VariacionPill valor={metodo.varPct} size="sm" />
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            El total de cobros no tiene por qué coincidir con la facturación del mes: se calculan
            sobre registros distintos.
          </p>
        </>
      )}
    </div>
  );
}
