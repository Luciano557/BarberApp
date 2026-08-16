import { useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { DerivedMonthlyMetrics, MetricCardDef, varKeyMap } from './types';

interface GastosGananciaBarProps {
  narrativeText: ReactNode;
  facturacion: number;
  gastos: number;
  ganancia: number;
  gananciaVar: number | null;
  rentabilidadMetric: MetricCardDef;
  puntoEquilibrioMetric: MetricCardDef;
  latest: DerivedMonthlyMetrics | null;
  formatCurrency: (v: number) => string;
}

function DetailRow({ metric, latest }: { metric: MetricCardDef; latest: DerivedMonthlyMetrics | null }) {
  const value = latest ? (latest[metric.dataKey] as number) : null;
  const vKey = varKeyMap[metric.dataKey as string];
  const variation = latest && vKey ? (latest[vKey] as number | null) : null;

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <metric.icon className={`h-5 w-5 shrink-0 ${metric.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{metric.title}</p>
        <p className="text-xs text-muted-foreground">{metric.description}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`text-xl font-bold ${metric.color}`}>{value != null ? metric.formatFn(value) : '—'}</span>
          {variation != null && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${variation > 0 ? 'text-status-success-foreground' : variation < 0 ? 'text-status-error-foreground' : 'text-muted-foreground'}`}>
              {variation > 0 ? <ArrowUpRight className="h-3 w-3" /> : variation < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
              {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Barra horizontal de 2 segmentos (Gastos / Ganancia) con la facturación total como referencia
 * arriba. Div+flex con anchos proporcionales — no Recharts: no hay patrón de barra de
 * composición de un total en la app (RankingBarCard es horizontal pero por ítem, no
 * composición), y esto es más simple y responsive sin contenedor de alto/ancho fijo.
 *
 * Al tocarla abre el detalle con Rentabilidad y Punto de Equilibrio (retirados de la vista
 * principal): son la misma relación facturación/gastos que la barra visualiza, tienen más
 * sentido como soporte del detalle que como cards sueltas.
 *
 * Única card de "Vistazo rápido" con fondo navy (--primary): concentra la frase narrativa y la
 * barra en un mismo bloque para darle jerarquía de "lo más importante de la pantalla".
 */
export function GastosGananciaBar({
  narrativeText,
  facturacion,
  gastos,
  ganancia,
  gananciaVar,
  rentabilidadMetric,
  puntoEquilibrioMetric,
  latest,
  formatCurrency,
}: GastosGananciaBarProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const hasData = facturacion > 0 || gastos > 0;
  const gastosPct = facturacion > 0 ? Math.min(100, (Math.max(0, gastos) / facturacion) * 100) : (gastos > 0 ? 100 : 0);
  const gananciaPct = ganancia > 0 ? Math.max(0, 100 - gastosPct) : 0;

  return (
    <>
      <Card
        className="cursor-pointer border-primary bg-primary text-primary-foreground transition-shadow hover:shadow-md"
        onClick={() => setDetailOpen(true)}
      >
        <CardContent className="pt-6">
          <p className="mb-4 text-sm leading-relaxed">{narrativeText}</p>

          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs text-primary-foreground/70">Facturación total del mes</span>
            <span className="text-sm font-semibold">{formatCurrency(facturacion)}</span>
          </div>

          {hasData ? (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-primary-foreground/15">
                <div className="h-full bg-primary-foreground/35" style={{ width: `${gastosPct}%` }} />
                <div className="h-full bg-primary-foreground" style={{ width: `${gananciaPct}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 text-primary-foreground/75">
                  <span className="h-2 w-2 shrink-0 rounded-[2px] bg-primary-foreground/35" />
                  Gastos: {formatCurrency(gastos)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-[2px] bg-primary-foreground" />
                  Ganancia: {formatCurrency(ganancia)}
                  {gananciaVar != null && (
                    <span className="inline-flex items-center gap-0.5 font-medium">
                      {gananciaVar > 0 ? <ArrowUpRight className="h-3 w-3" /> : gananciaVar < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                      {gananciaVar > 0 ? '+' : ''}{gananciaVar.toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>
              {ganancia < 0 && (
                <p className="mt-2 text-xs font-medium text-primary-foreground">Este mes los gastos superaron la facturación.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-primary-foreground/70">Sin datos suficientes este mes.</p>
          )}

          <p className="mt-3 text-[11px] text-primary-foreground/85">Tocá para ver rentabilidad y punto de equilibrio.</p>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gastos y Ganancia</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Facturación: {formatCurrency(facturacion)} · Gastos: {formatCurrency(gastos)} · Ganancia: {formatCurrency(ganancia)}
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <DetailRow metric={rentabilidadMetric} latest={latest} />
            <DetailRow metric={puntoEquilibrioMetric} latest={latest} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
