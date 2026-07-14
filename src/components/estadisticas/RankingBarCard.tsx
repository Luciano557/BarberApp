import { ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export interface RankingBarItem {
  label: string;
  value: number;
  formattedValue?: string;
}

interface RankingBarCardProps {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  data: RankingBarItem[];
}

export function RankingBarCard({ title, description, icon: Icon, data }: RankingBarCardProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const max = sorted.length > 0 ? sorted[0].value : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>
        ) : (
          sorted.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground truncate">{item.label}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">{item.formattedValue ?? item.value}</span>
              </div>
              <Progress value={max > 0 ? (item.value / max) * 100 : 0} className="h-2" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
