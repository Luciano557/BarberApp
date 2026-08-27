import { ComponentType, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MiniStatCardProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  value: string;
  /** % de variación vs. mes anterior. Sin esto, no se muestra badge (ej. Deuda pendiente, que no tiene serie mensual). */
  variation?: number | null;
  /** Línea chica debajo del valor — ej. próxima cuota, o la aclaración de que Deuda pendiente no entra en la barra de arriba. */
  caption?: ReactNode;
  /** Sin esto, la card no es clickeable (ej. Deuda pendiente: es una foto "a hoy", sin detalle mensual que mostrar). */
  onClick?: () => void;
  /** 'accent' = tratamiento en tono ámbar (--status-warning), para que Deuda pendiente no se confunda con el resto de la fila. */
  variant?: 'default' | 'accent';
  className?: string;
}

/**
 * Card chica de estadística puntual, sin mini-gráfico embebido — a diferencia de MetricCard.
 * Pensada para la fila de 3 de "Vistazo rápido" (Servicios, Ticket promedio, Deuda pendiente).
 */
export function MiniStatCard({
  title,
  icon: Icon,
  value,
  variation,
  caption,
  onClick,
  variant = 'default',
  className,
}: MiniStatCardProps) {
  const isAccent = variant === 'accent';

  return (
    <Card
      className={cn(
        onClick && 'cursor-pointer transition-shadow hover:shadow-md',
        isAccent && 'border-status-warning/40 bg-status-warning-bg',
        className,
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn('text-sm font-medium', isAccent && 'text-status-warning-foreground')}>{title}</CardTitle>
        <Icon className={cn('h-4 w-4 shrink-0', isAccent ? 'text-status-warning-foreground' : 'text-muted-foreground')} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-2xl font-bold', isAccent && 'text-status-warning-foreground')}>{value}</span>
          {variation != null && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${variation > 0 ? 'text-status-success-foreground' : variation < 0 ? 'text-status-error-foreground' : 'text-muted-foreground'}`}>
              {variation > 0 ? <ArrowUpRight className="h-3 w-3" /> : variation < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
              {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
            </span>
          )}
        </div>
        {caption && (
          <div className={cn('mt-1 text-xs', isAccent ? 'text-status-warning-foreground' : 'text-muted-foreground')}>{caption}</div>
        )}
      </CardContent>
    </Card>
  );
}
