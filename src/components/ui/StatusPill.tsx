import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusPillStatus = 'success' | 'neutral' | 'info' | 'warning' | 'error';

interface StatusPillProps {
  status: StatusPillStatus;
  label: string;
  /** Ícono que reemplaza el dot (ej: Lock, AlertTriangle). false = ni dot ni ícono (solo texto). Omitido = dot por defecto. */
  icon?: LucideIcon | false;
  size?: 'sm' | 'md'; // sm: text-[10px] px-2 py-0.5 · md (default): text-xs px-2.5 py-0.5
  className?: string;
}

type StatusConfig = {
  containerClass: string;
  dotClass: string;
};

const statusConfig: Record<StatusPillStatus, StatusConfig> = {
  success: {
    containerClass: 'bg-status-success-bg text-status-success-foreground border-status-success',
    dotClass: 'bg-status-success',
  },
  neutral: {
    containerClass: 'bg-secondary text-secondary-foreground border-border',
    dotClass: 'bg-muted-foreground',
  },
  info: {
    containerClass: 'bg-status-info-bg text-status-info-foreground border-status-info',
    dotClass: 'bg-status-info',
  },
  warning: {
    containerClass: 'bg-status-warning-bg text-status-warning-foreground border-status-warning',
    dotClass: 'bg-status-warning',
  },
  error: {
    containerClass: 'bg-status-error-bg text-status-error-foreground border-status-error',
    dotClass: 'bg-status-error',
  },
};

const sizeClasses = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-0.5',
} as const;

export function StatusPill({ status, label, icon, size = 'md', className }: StatusPillProps) {
  const config = statusConfig[status];
  const Icon = icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold',
        sizeClasses[size],
        config.containerClass,
        className,
      )}
    >
      {Icon ? (
        <Icon className="h-3 w-3 shrink-0" />
      ) : Icon === undefined ? (
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', config.dotClass)} />
      ) : null}
      {label}
    </span>
  );
}
