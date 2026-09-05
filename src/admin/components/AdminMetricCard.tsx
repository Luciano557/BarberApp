import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AdminMetricCardProps {
  label: string;
  value?: string | number;
  hint: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
  loading?: boolean;
}

const toneClasses: Record<NonNullable<AdminMetricCardProps['tone']>, string> = {
  neutral: 'bg-primary/10 text-primary',
  success: 'bg-status-success-bg text-status-success-foreground',
  warning: 'bg-status-warning-bg text-status-warning-foreground',
  error: 'bg-status-error-bg text-status-error-foreground',
  info: 'bg-status-info-bg text-status-info-foreground',
};

export function AdminMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  loading = false,
}: AdminMetricCardProps) {
  return (
    <Card className="p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-20" />
          ) : (
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value ?? '—'}</p>
          )}
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-tile', toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
