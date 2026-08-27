import { useRef } from 'react';
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
  /** Nombre accesible del grupo — aria-label del tablist. Omitilo si el contexto ya lo identifica (ej. un heading inmediatamente antes). */
  ariaLabel?: string;
}

export function SegmentedControl({ options, value, onChange, className, ariaLabel }: SegmentedControlProps) {
  const activeIndex = options.findIndex((o) => o.value === value);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving tabindex + flechas/Home/End, mismo patrón de teclado que Radix Tabs
  // (activación automática: mover el foco ya selecciona la opción).
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % options.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + options.length) % options.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextOption = options[nextIndex];
    onChange(nextOption.value);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
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

      {options.map((opt, index) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => { buttonRefs.current[index] = el; }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
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
