import * as React from 'react';

interface SelectableCardProps {
  selected?: boolean;
  number?: number;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

/**
 * Tarjeta de selección reutilizable del stepper de Cobrar.
 * Solo capa visual: estados normal / selected / disabled y feedback de press.
 * La lógica de selección vive en el componente que la usa.
 */
export function SelectableCard({
  selected = false,
  number,
  onClick,
  children,
  className = '',
  disabled = false,
}: SelectableCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative w-full rounded-lg border p-4 transition-all duration-150 sm:p-6',
        'motion-reduce:transition-none',
        disabled
          ? 'cursor-not-allowed pointer-events-none opacity-50'
          : 'active:scale-[0.98] motion-reduce:active:scale-100',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
        className,
      ].join(' ')}
    >
      {typeof number === 'number' && (
        <span className="absolute left-3 top-2 font-mono text-xs text-muted-foreground">
          {number}
        </span>
      )}
      {children}
    </button>
  );
}
