import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InlineReadErrorProps {
  message: string;
  description?: string;
  onRetry: () => void;
  /** true (default): dibuja su propio contenedor, para reemplazar contenido. false: ya vive dentro de un contenedor (Card, Dialog). */
  bordered?: boolean;
  className?: string;
}

/** Error terminal de una lectura sin datos previos — nunca un EmptyState. */
export function InlineReadError({
  message,
  description = 'Revisá tu conexión e intentá de nuevo.',
  onRetry,
  bordered = true,
  className,
}: InlineReadErrorProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-4 py-8 text-center',
        bordered && 'rounded-xl border border-border bg-card',
        className,
      )}
    >
      <AlertTriangle className="h-5 w-5 text-status-warning" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
