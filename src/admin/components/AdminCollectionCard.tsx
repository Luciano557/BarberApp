import type { LucideIcon, } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineReadError } from '@/components/ui/InlineReadError';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { cn } from '@/lib/utils';

interface AdminCollectionCardProps {
  toolbar: ReactNode;
  children: ReactNode;
  isPending: boolean;
  isError: boolean;
  isFetching?: boolean;
  hasData: boolean;
  isEmpty: boolean;
  errorMessage: string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  onRetry: () => void;
  footer?: ReactNode;
  className?: string;
}

function CollectionSkeleton() {
  return (
    <div className="space-y-3 px-4 py-5 sm:px-5" aria-label="Cargando datos">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b pb-3 last:border-0 last:pb-0">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-[min(72%,18rem)]" />
            <Skeleton className="h-3 w-[min(48%,12rem)]" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function AdminCollectionCard({
  toolbar,
  children,
  isPending,
  isError,
  isFetching = false,
  hasData,
  isEmpty,
  errorMessage,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  onRetry,
  footer,
  className,
}: AdminCollectionCardProps) {
  const showSkeleton = useDelayedVisible(isPending && !hasData);

  let content: ReactNode;
  if (isError && !hasData) {
    content = <InlineReadError bordered={false} message={errorMessage} onRetry={onRetry} className="min-h-64 justify-center" />;
  } else if (isPending && !hasData) {
    content = showSkeleton ? <CollectionSkeleton /> : <div className="min-h-64" />;
  } else if (isEmpty) {
    content = (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        className="min-h-64 px-6 py-10"
      />
    );
  } else {
    content = (
      <>
        {isError && hasData && (
          <div className="flex items-center justify-between gap-3 border-b border-status-warning bg-status-warning-bg px-4 py-2.5 text-xs text-status-warning-foreground sm:px-5">
            <span>No se pudo actualizar. Se mantienen los últimos datos disponibles.</span>
            <button type="button" onClick={onRetry} className="shrink-0 font-medium underline underline-offset-2 hover:no-underline">
              Reintentar
            </button>
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <Card className={cn('overflow-clip', className)}>
      <div className="relative border-b border-border p-4 sm:p-5">
        {toolbar}
        {isFetching && hasData && (
          <div className="absolute right-4 top-4 flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="sr-only sm:not-sr-only">Actualizando</span>
          </div>
        )}
      </div>
      <div>{content}</div>
      {footer && !isPending && !isError && !isEmpty && (
        <div className="border-t border-border px-4 py-3 sm:px-5">{footer}</div>
      )}
    </Card>
  );
}
