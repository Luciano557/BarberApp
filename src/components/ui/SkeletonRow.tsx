import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SkeletonRowProps {
  /** Elemento inicial de la fila. 'circle' para avatares/iniciales, 'bar' para EntityColorBar, false para omitir. */
  leading?: 'circle' | 'bar' | false;
  lines?: 1 | 2;
  className?: string;
}

/** Fila de skeleton para listas de ítems previsibles (producto, cliente, cierre, movimiento). El consumidor decide contenedor (Card, fila plana) y cuántas repetir. */
export function SkeletonRow({ leading = 'circle', lines = 2, className }: SkeletonRowProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {leading === 'circle' && <Skeleton className="h-9 w-9 shrink-0 rounded-full" />}
      {leading === 'bar' && <Skeleton className="h-8 w-1 shrink-0 rounded-full" />}
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-2/3" />
        {lines === 2 && <Skeleton className="h-3 w-1/3" />}
      </div>
    </div>
  );
}
