import { cn } from '@/lib/utils';

export interface SegmentOption {
  value: string;
  label: string;
  count?: number;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  const activeIndex = options.findIndex((o) => o.value === value);

  return (
    <div
      role="tablist"
      className={cn('relative inline-flex w-full rounded-md border border-border bg-muted/50 p-0.5', className)}
    >
      {/* Pill deslizante */}
      {activeIndex >= 0 && (
        <div
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-[calc(var(--radius)-2px)] bg-primary shadow-sm transition-transform duration-200 ease-out"
          style={{
            width: `calc(${100 / options.length}% - 4px)`,
            transform: `translateX(calc(${activeIndex} * 100%))`,
          }}
        />
      )}

      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3 py-1.5 text-xs font-medium transition-colors duration-150',
              isActive
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={cn(
                  'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'border border-border text-muted-foreground',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
