import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusPillProps {
  status: 'success' | 'neutral' | 'info' | 'warning' | 'error';
  label: string;
  icon?: boolean;
  className?: string;
}

type DotConfig = {
  kind: 'dot';
  dotClass: string;
  containerClass: string;
};

type IconConfig = {
  kind: 'icon';
  Icon: React.ComponentType<{ className?: string }>;
  containerClass: string;
};

const statusConfig: Record<StatusPillProps['status'], DotConfig | IconConfig> = {
  success: {
    kind: 'dot',
    dotClass: 'bg-status-success',
    containerClass: 'bg-status-success-bg text-status-success-foreground border-status-success',
  },
  neutral: {
    kind: 'dot',
    dotClass: 'bg-muted-foreground',
    containerClass: 'bg-secondary text-secondary-foreground border-border',
  },
  info: {
    kind: 'dot',
    dotClass: 'bg-status-info',
    containerClass: 'bg-status-info-bg text-status-info-foreground border-status-info',
  },
  warning: {
    kind: 'icon',
    Icon: Clock,
    containerClass: 'bg-status-warning-bg text-status-warning-foreground border-status-warning',
  },
  error: {
    kind: 'icon',
    Icon: AlertTriangle,
    containerClass: 'bg-status-error-bg text-status-error-foreground border-status-error',
  },
};

export function StatusPill({ status, label, icon = true, className }: StatusPillProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        config.containerClass,
        className,
      )}
    >
      {config.kind === 'dot' && (
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', config.dotClass)} />
      )}
      {config.kind === 'icon' && icon && (
        <config.Icon className="h-3 w-3 shrink-0" />
      )}
      {label}
    </span>
  );
}
