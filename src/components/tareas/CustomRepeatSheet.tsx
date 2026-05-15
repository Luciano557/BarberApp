import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, Minus, Plus } from 'lucide-react';

const FREQUENCIES = [
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensualmente' },
  { value: 'yearly', label: 'Anualmente' },
];

const WEEKDAYS = [
  { value: 1, label: 'Lunes', short: 'L' },
  { value: 2, label: 'Martes', short: 'M' },
  { value: 3, label: 'Miércoles', short: 'X' },
  { value: 4, label: 'Jueves', short: 'J' },
  { value: 5, label: 'Viernes', short: 'V' },
  { value: 6, label: 'Sábado', short: 'S' },
  { value: 0, label: 'Domingo', short: 'D' },
];

const MAX_INTERVAL = 99;

interface CustomRepeatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frequency: string;
  interval: number;
  byweekday: number[];
  onConfirm: (freq: string, interval: number, byweekday: number[]) => void;
}

export function CustomRepeatSheet({ open, onOpenChange, frequency: initFreq, interval: initInterval, byweekday: initDays, onConfirm }: CustomRepeatSheetProps) {
  const [frequency, setFrequency] = useState(initFreq || 'weekly');
  const [interval, setInterval] = useState(initInterval && initInterval >= 1 ? initInterval : 1);
  const [selectedDays, setSelectedDays] = useState<number[]>(initDays?.length ? initDays : []);

  useEffect(() => {
    if (open) {
      setFrequency(initFreq || 'weekly');
      setInterval(initInterval && initInterval >= 1 ? initInterval : 1);
      setSelectedDays(initDays?.length ? initDays : []);
    }
  }, [open, initFreq, initInterval, initDays]);

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const decInterval = () => setInterval(v => Math.max(1, v - 1));
  const incInterval = () => setInterval(v => Math.min(MAX_INTERVAL, v + 1));

  const unitSingular = { daily: 'día', weekly: 'semana', monthly: 'mes', yearly: 'año' }[frequency] || 'día';
  const unitPlural = { daily: 'días', weekly: 'semanas', monthly: 'meses', yearly: 'años' }[frequency] || 'días';
  const unitLabel = interval === 1 ? unitSingular : unitPlural;

  const summary = (() => {
    if (frequency === 'weekly' && selectedDays.length > 0) {
      const days = [...selectedDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
        .map(d => WEEKDAYS.find(w => w.value === d)?.label)
        .filter(Boolean)
        .join(', ');
      return `Cada ${interval === 1 ? '' : `${interval} `}${unitLabel} los ${days}.`;
    }
    return `Se repetirá cada ${interval === 1 ? '' : `${interval} `}${unitLabel}.`;
  })();

  const weeklyNeedsDays = frequency === 'weekly' && selectedDays.length === 0;
  const canConfirm = !weeklyNeedsDays && interval >= 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Repetición personalizada</SheetTitle>
          <SheetDescription>Definí cada cuánto y, si aplica, en qué días debe repetirse la tarea.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Frequency */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Frecuencia</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interval stepper */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Cada</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={decInterval}
                disabled={interval <= 1}
                aria-label="Disminuir intervalo"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex-1 h-10 rounded-md border border-border flex items-center justify-center text-sm font-medium tabular-nums">
                {interval} {unitLabel}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={incInterval}
                disabled={interval >= MAX_INTERVAL}
                aria-label="Aumentar intervalo"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{summary}</p>
          </div>

          {/* Weekday selector for weekly */}
          {frequency === 'weekly' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Días de la semana</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map(day => {
                  const active = selectedDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={
                        'h-10 rounded-md border text-xs font-medium transition-colors ' +
                        (active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:bg-muted')
                      }
                      aria-pressed={active}
                      aria-label={day.label}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
              {weeklyNeedsDays && (
                <p className="text-xs text-destructive">Elegí al menos un día de la semana.</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              disabled={!canConfirm}
              onClick={() => {
                onConfirm(frequency, interval, frequency === 'weekly' ? selectedDays : []);
                onOpenChange(false);
              }}
            >
              <Check className="h-4 w-4 mr-2" />Aplicar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function getCustomRepeatLabel(frequency: string | null, interval: number | null, byweekday: number[] | null): string {
  if (!frequency) return 'Personalizado';
  const WEEKDAY_NAMES: Record<number, string> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };
  const freqLabel = FREQUENCIES.find(f => f.value === frequency)?.label || frequency;
  let label = freqLabel;
  if (interval && interval > 1) {
    const unit = { daily: 'días', weekly: 'semanas', monthly: 'meses', yearly: 'años' }[frequency] || '';
    label = `Cada ${interval} ${unit}`;
  }
  if (frequency === 'weekly' && byweekday?.length) {
    const days = [...byweekday].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
      .map(d => WEEKDAY_NAMES[d]).join(', ');
    label += `, ${days}`;
  }
  return label;
}
