import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { DonutCard, DonutCardSlice } from './DonutCard';
import { MiniStatCard } from './MiniStatCard';
import { GastosGananciaBar } from './GastosGananciaBar';
import { DerivedMonthlyMetrics, MetricCardDef, varKeyMap } from './types';
import type { ProximaCuota } from './useDeudaPendienteData';

interface VistazoRapidoProps {
  facturacion: number;
  gastos: number;
  ganancia: number;
  gananciaVar: number | null;
  latest: DerivedMonthlyMetrics | null;
  serviciosCard: MetricCardDef;
  ticketPromedioCard: MetricCardDef;
  rentabilidadCard: MetricCardDef;
  puntoEquilibrioCard: MetricCardDef;
  onSelectMetric: (metric: MetricCardDef) => void;
  metodoPagoSlices: DonutCardSlice[];
  digitalTrendText: ReactNode;
  formatCurrency: (v: number) => string;
  saldoPendiente: number;
  proximaCuota: ProximaCuota | null;
}

/**
 * Orquestador de la sección "Vistazo rápido" (reemplaza a "Resumen"): frase narrativa, barra
 * Gastos/Ganancia, fila de 3 mini-cards (Servicios / Ticket promedio / Deuda pendiente) y el
 * donut de Métodos de pago reubicado desde "Plata real". Componente propio en vez de seguir
 * inflando EstadisticasPanel.tsx.
 */
export function VistazoRapido({
  facturacion,
  gastos,
  ganancia,
  gananciaVar,
  latest,
  serviciosCard,
  ticketPromedioCard,
  rentabilidadCard,
  puntoEquilibrioCard,
  onSelectMetric,
  metodoPagoSlices,
  digitalTrendText,
  formatCurrency,
  saldoPendiente,
  proximaCuota,
}: VistazoRapidoProps) {
  const hasNarrativeData = facturacion > 0 || gastos > 0;

  const gananciaVarSuffix = gananciaVar == null
    ? ''
    : ` ${gananciaVar > 0 ? '↑' : gananciaVar < 0 ? '↓' : ''}${Math.abs(gananciaVar).toFixed(1)}% vs. mes anterior`;

  const narrativeText = !hasNarrativeData
    ? 'Todavía no hay datos de facturación este mes.'
    : ganancia >= 0
      ? `Este mes facturaste ${formatCurrency(facturacion)}. Después de gastos, te quedaron ${formatCurrency(ganancia)}${gananciaVarSuffix}.`
      : `Este mes facturaste ${formatCurrency(facturacion)}. Los gastos superaron lo facturado por ${formatCurrency(Math.abs(ganancia))}.`;

  const serviciosVar = latest ? (latest[varKeyMap[serviciosCard.dataKey as string]] as number | null) : null;
  const ticketPromedioVar = latest ? (latest[varKeyMap[ticketPromedioCard.dataKey as string]] as number | null) : null;

  const proximaCuotaCaption = proximaCuota
    ? `Próxima cuota: ${formatCurrency(proximaCuota.monto)} (${new Date(`${proximaCuota.fecha}T00:00:00`).toLocaleDateString('es-AR')}) — no incluida en Gastos/Ganancia arriba`
    : 'No incluida en Gastos/Ganancia arriba';

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vistazo rápido</h2>

      <GastosGananciaBar
        narrativeText={narrativeText}
        facturacion={facturacion}
        gastos={gastos}
        ganancia={ganancia}
        gananciaVar={gananciaVar}
        rentabilidadMetric={rentabilidadCard}
        puntoEquilibrioMetric={puntoEquilibrioCard}
        latest={latest}
        formatCurrency={formatCurrency}
      />

      {/* Mismo breakpoint que "Horarios Pico" (behaviorSection, más abajo en el panel) para 3
          elementos en fila sin amontonarse en mobile. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniStatCard
          title={serviciosCard.title}
          icon={serviciosCard.icon}
          value={latest ? serviciosCard.formatFn(latest.servicios) : '—'}
          variation={serviciosVar}
          onClick={() => onSelectMetric(serviciosCard)}
        />
        <MiniStatCard
          title={ticketPromedioCard.title}
          icon={ticketPromedioCard.icon}
          value={latest ? ticketPromedioCard.formatFn(latest.ticketPromedio) : '—'}
          variation={ticketPromedioVar}
          onClick={() => onSelectMetric(ticketPromedioCard)}
        />
        <MiniStatCard
          title="Deuda pendiente"
          icon={Wallet}
          value={formatCurrency(saldoPendiente)}
          variant="accent"
          caption={proximaCuotaCaption}
        />
      </div>

      <DonutCard
        title="Cómo se cobra"
        description="Composición de los cobros de este mes."
        data={metodoPagoSlices}
        formatValue={formatCurrency}
        footer={<p className="mt-3 text-xs">{digitalTrendText}</p>}
      />
    </div>
  );
}
