import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, CheckCircle } from 'lucide-react';

const FREQUENCIES = [
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensualmente' },
  { value: 'yearly', label: 'Anualmente' },
];

const WEEKDAYS = [
  { value: 0, label: 'Domingo', short: 'D' },
  { value: 1, label: 'Lunes', short: 'L' },
  { value: 2, label: 'Martes', short: 'M' },
  { value: 3, label: 'Miércoles', short: 'X' },
  { value: 4, label: 'Jueves', short: 'J' },
  { value: 5, label: 'Viernes', short: 'V' },
  { value: 6, label: 'Sábado', short: 'S' },
];

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
  const [interval, setInterval] = useState(initInterval || 1);
  const [selectedDays, setSelectedDays] = useState<number[]>(initDays.length ? initDays : []);

  useEffect(() => {
    if (open) {
      setFrequency(initFreq || 'weekly');
      setInterval(initInterval || 1);
      setSelectedDays(initDays.length ? initDays : []);
    }
  }, [open, initFreq, initInterval, initDays]);

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const getHelpText = () => {
    const unit = {
      daily: interval === 1 ? 'día' : 'días',
      weekly: interval === 1 ? 'semana' : 'semanas',
      monthly: interval === 1 ? 'mes' : 'meses',
      yearly: interval === 1 ? 'año' : 'años',
    }[frequency] || 'día';
    return `El evento se repetirá cada ${interval === 1 ? '' : interval + ' '}${unit}.`;
  };

  const canConfirm = frequency !== 'weekly' || selectedDays.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle className="text-center flex-1">Personalizado</SheetTitle>
          <Button
            size="icon"
            variant="ghost"
            className="text-primary"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm(frequency, interval, frequency === 'weekly' ? selectedDays : []);
              onOpenChange(false);
            }}
          >
            <CheckCircle className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Frequency */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Frecuencia</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interval */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Cada</Label>
            <Input
              type="number"
              inputMode="numeric"
              className="w-20 text-right"
              min={1}
              max={999}
              value={interval}
              onChange={e => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          <p className="text-xs text-muted-foreground">{getHelpText()}</p>

          {/* Weekday selector for weekly */}
          {frequency === 'weekly' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Días de la semana</Label>
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {WEEKDAYS.map(day => (
                  <button
                    key={day.value}
                    className="flex items-center justify-between w-full py-3 px-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => toggleDay(day.value)}
                  >
                    <span className="text-sm">{day.label}</span>
                    {selectedDays.includes(day.value) && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function getCustomRepeatLabel(frequency: string | null, interval: number | null, byweekday: number[] | null): string {
  if (!frequency) return 'Personalizado';
  const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const freq = FREQUENCIES.find(f => f.value === frequency);
  const freqLabel = freq?.label || frequency;
  let label = freqLabel;
  if (interval && interval > 1) {
    const unit = { daily: 'días', weekly: 'semanas', monthly: 'meses', yearly: 'años' }[frequency] || '';
    label = `Cada ${interval} ${unit}`;
  }
  if (frequency === 'weekly' && byweekday?.length) {
    const days = byweekday.sort().map(d => WEEKDAY_NAMES[d]).join(', ');
    label += `, ${days}`;
  }
  return label;
}
