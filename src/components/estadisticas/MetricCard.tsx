import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricChart } from './MetricChart';
import { DerivedMonthlyMetrics, MetricCardDef, varKeyMap } from './types';

function renderVariationBadge(metric: MetricCardDef, latest: DerivedMonthlyMetrics | null) {
  const vKey = varKeyMap[metric.dataKey as string];
  if (!latest || !vKey) return null;
  const variation = latest[vKey] as number | null;
  if (variation == null) return null;
  const isPartial = latest.isCurrentMonth && latest.diasTranscurridos;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${variation > 0 ? 'text-status-success-foreground' : variation < 0 ? 'text-status-error-foreground' : 'text-muted-foreground'}`}>
      {variation > 0 ? <ArrowUpRight className="h-3 w-3" /> : variation < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
      {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
      {isPartial && (
        <span className="ml-1 text-muted-foreground" title={`Estimación basada en los primeros ${latest.diasTranscurridos} días del mes, comparados con los mismos ${latest.diasTranscurridos} días del mes anterior`}>
          <Clock className="h-3 w-3 inline" />
        </span>
      )}
    </span>
  );
}

interface MetricCardProps {
  metric: MetricCardDef;
  data: DerivedMonthlyMetrics[];
  latest: DerivedMonthlyMetrics | null;
  onSelect: (metric: MetricCardDef) => void;
  className?: string;
  /** 'lg' preserves the Servicios card's taller mini-chart (h-52 vs h-40). */
  chartSize?: 'sm' | 'lg';
  /** Preserves the Servicios card's tooltip, which shows the long formatter instead of the short one. */
  tooltipFormatFn?: (v: number) => string;
  /** Extra content rendered below the chart (e.g. Tasa de Ocupación's capacidad input + explicación). */
  children?: ReactNode;
  /** Rendered before the headline value — for caveats that must precede the number, not just follow the chart (e.g. "esta cifra puede ser imprecisa"). */
  banner?: ReactNode;
}

export function MetricCard({
  metric,
  data,
  latest,
  onSelect,
  className,
  chartSize = 'sm',
  tooltipFormatFn,
  children,
  banner,
}: MetricCardProps) {
  return (
    <Card
      className={cn('cursor-pointer transition-shadow hover:shadow-md', className)}
      onClick={() => onSelect(metric)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{metric.description}</p>
        </div>
        <metric.icon className={`h-4 w-4 ${metric.color} shrink-0`} />
      </CardHeader>
      <CardContent>
        {banner}
        {latest && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-2xl font-bold ${metric.color}`}>
              {metric.formatFn(latest[metric.dataKey] as number)}
            </span>
            {renderVariationBadge(metric, latest)}
          </div>
        )}
        <MetricChart
          data={data}
          dataKey={metric.dataKey}
          color={metric.chartColor}
          formatValue={metric.shortFormatFn}
          tooltipFormatFn={tooltipFormatFn}
          size={chartSize}
        />
        {children}
      </CardContent>
    </Card>
  );
}
