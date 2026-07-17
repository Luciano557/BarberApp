import { ComponentType, ReactNode, useState } from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';
import { DonutDetailDialog } from './DonutDetailDialog';

export interface DonutCardSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutCardProps {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  data: DonutCardSlice[];
  /** Total used for the % breakdown; defaults to the sum of all slice values. */
  total?: number;
  formatValue?: (v: number) => string;
  /** Extra content rendered inside the card, below the chart+legend (e.g. a one-line trend caption). */
  footer?: ReactNode;
}

export function DonutCard({
  title,
  description,
  icon: Icon,
  data,
  total,
  formatValue = (v) => `${v}`,
  footer,
}: DonutCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [detailOpen, setDetailOpen] = useState(false);
  const computedTotal = total ?? data.reduce((sum, d) => sum + d.value, 0);
  const config = data.reduce((acc, d) => {
    acc[d.label] = { label: d.label, color: d.color };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);
  const clickable = data.length > 0;

  return (
    <Card
      className={cn(clickable && 'cursor-pointer transition-shadow hover:shadow-md')}
      onClick={clickable ? () => setDetailOpen(true) : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ChartContainer config={config} className="h-40 w-40 shrink-0 aspect-square">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => `${name}: ${formatValue(Number(value))}`}
                    />
                  }
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="60%"
                  outerRadius="90%"
                  paddingAngle={2}
                  isAnimationActive={!prefersReducedMotion}
                >
                  {data.map((slice) => (
                    <Cell key={slice.label} fill={slice.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex-1 w-full space-y-1.5">
              {data.map((slice) => (
                <div key={slice.label} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-[2px] shrink-0" style={{ backgroundColor: slice.color }} />
                  <span className="max-w-[140px] truncate text-muted-foreground" title={slice.label}>{slice.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {footer}
      </CardContent>
      <DonutDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={title}
        description={description}
        data={data}
        total={total}
        formatValue={formatValue}
      />
    </Card>
  );
}
