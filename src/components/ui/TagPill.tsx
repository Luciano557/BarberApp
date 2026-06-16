import { cn } from '@/lib/utils';

interface TagPillProps {
  label: string;
  className?: string;
}

export function TagPill({ label, className }: TagPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        'bg-status-info-bg text-status-info-foreground border-status-info',
        className,
      )}
    >
      {label}
    </span>
  );
}
