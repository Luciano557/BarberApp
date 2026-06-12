const FALLBACK_COLOR = 'hsl(var(--muted-foreground))';

const sizeClasses = {
  default: 'h-1 w-full shrink-0 rounded-full sm:h-10 sm:w-1',
  sm: 'h-0.5 w-full shrink-0 rounded-full sm:h-5 sm:w-1',
};

interface EntityColorBarProps {
  color: string | null | undefined;
  size?: 'sm' | 'default';
}

export function EntityColorBar({ color, size = 'default' }: EntityColorBarProps) {
  return (
    <div
      className={sizeClasses[size]}
      style={{ backgroundColor: color || FALLBACK_COLOR }}
      aria-hidden
    />
  );
}
