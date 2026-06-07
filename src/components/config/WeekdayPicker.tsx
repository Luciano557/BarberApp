import { cn } from '@/lib/utils';

/** ISO weekday labels: 1=Lun .. 7=Dom. */
const DAYS: { iso: number; label: string }[] = [
  { iso: 1, label: 'L' },
  { iso: 2, label: 'M' },
  { iso: 3, label: 'M' },
  { iso: 4, label: 'J' },
  { iso: 5, label: 'V' },
  { iso: 6, label: 'S' },
  { iso: 7, label: 'D' },
];

interface WeekdayPickerProps {
  /** Días seleccionados (ISO 1=Lun..7=Dom). */
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Selector de días de semana sin componente horario.
 * Devuelve `number[]` ordenado, valores 1..7 ISO.
 */
export function WeekdayPicker({ value, onChange, disabled, className }: WeekdayPickerProps) {
  const toggle = (iso: number) => {
    if (disabled) return;
    const set = new Set(value);
    if (set.has(iso)) set.delete(iso); else set.add(iso);
    onChange(Array.from(set).sort((a, b) => a - b));
  };

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} role="group" aria-label="Días de la semana">
      {DAYS.map(d => {
        const selected = value.includes(d.iso);
        return (
          <button
            key={d.iso}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => toggle(d.iso)}
            className={cn(
              'h-9 w-9 rounded-md border text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-accent/40',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

/** Etiqueta corta tipo "L, M, J" para una lista ISO. */
export function formatDiasSemana(dias: number[] | null | undefined): string {
  if (!dias || dias.length === 0) return '—';
  const map: Record<number, string> = { 1: 'L', 2: 'M', 3: 'M', 4: 'J', 5: 'V', 6: 'S', 7: 'D' };
  return [...dias].sort((a, b) => a - b).map(d => map[d] ?? '?').join(', ');
}
