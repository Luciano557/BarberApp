import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Line,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { DerivedMonthlyMetrics, varKeyMap } from './types';

interface MetricChartProps {
  data: DerivedMonthlyMetrics[];
  dataKey: keyof DerivedMonthlyMetrics;
  color: string;
  formatValue: (v: number) => string;
  /** Formatter used inside the tooltip; defaults to formatValue. Servicios uses its long formatter here. */
  tooltipFormatFn?: (v: number) => string;
  /** 'lg' matches the taller/larger-tick variant the Servicios card used inline. Defaults to 'sm' (h-40). */
  size?: 'sm' | 'lg';
}

export function MetricChart({
  data,
  dataKey,
  color,
  formatValue,
  tooltipFormatFn,
  size = 'sm',
}: MetricChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const config = { [dataKey]: { label: dataKey, color } };
  const vKey = varKeyMap[dataKey as string];
  const tooltipValueFn = tooltipFormatFn ?? formatValue;
  const heightClass = size === 'lg' ? 'h-52' : 'h-40';
  const tickFontSize = size === 'lg' ? 11 : 10;

  return (
    <ChartContainer config={config} className={`${heightClass} w-full mt-3`}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="monthLabel" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: tickFontSize }} />
        <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: tickFontSize }} width={45} tickFormatter={(v) => formatValue(v)} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => {
                const varVal = vKey ? (item.payload as any)?.[vKey] : null;
                const varStr = varVal != null ? ` (${varVal > 0 ? '+' : ''}${varVal.toFixed(1)}%)` : '';
                return `${tooltipValueFn(Number(value))}${varStr}`;
              }}
            />
          }
        />
        <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} opacity={0.7} isAnimationActive={!prefersReducedMotion} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={!prefersReducedMotion} />
      </ComposedChart>
    </ChartContainer>
  );
}
