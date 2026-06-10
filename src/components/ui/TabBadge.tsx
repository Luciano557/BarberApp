import { cn } from '@/lib/utils';

interface TabBadgeProps {
  count: number;
  className?: string;
}

export function TabBadge({ count, className }: TabBadgeProps) {
  return (
    <span
      className={cn(
        'ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums transition-colors',
        'group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground',
        'group-data-[state=inactive]:border group-data-[state=inactive]:border-border group-data-[state=inactive]:text-muted-foreground',
        className
      )}
    >
      {count}
    </span>
  );
}
