import { ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export interface RankingBarItem {
  /** Identificador estable (ej. barbero_id) — usado como key y devuelto en onItemClick. */
  id?: string;
  label: string;
  /** Texto chico debajo del label, ej. ticket promedio. */
  sublabel?: string;
  value: number;
  formattedValue?: string;
}

interface RankingBarCardProps {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  data: RankingBarItem[];
  /** Si se pasa, cada fila se vuelve clickeable (ej. abrir detalle mensual de ese barbero). */
  onItemClick?: (item: RankingBarItem) => void;
}

export function RankingBarCard({ title, description, icon: Icon, data, onItemClick }: RankingBarCardProps) {
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
            <div
              key={item.id ?? item.label}
              className={`space-y-1 ${onItemClick ? 'cursor-pointer rounded-md -mx-2 px-2 py-1 hover:bg-muted/50 transition-colors' : ''}`}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground truncate">{item.label}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">{item.formattedValue ?? item.value}</span>
              </div>
              <Progress value={max > 0 ? (item.value / max) * 100 : 0} className="h-2" />
              {item.sublabel && <p className="text-[11px] text-muted-foreground">{item.sublabel}</p>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
