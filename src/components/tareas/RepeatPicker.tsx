import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Check } from 'lucide-react';

const PRESETS = [
  { value: 'never', label: 'Nunca' },
  { value: 'daily', label: 'Cada día' },
  { value: 'weekdays', label: 'Entre semana' },
  { value: 'weekends', label: 'Fines de semana' },
  { value: 'weekly', label: 'Cada semana' },
  { value: 'biweekly', label: 'Cada dos semanas' },
  { value: 'monthly', label: 'Cada mes' },
  { value: 'quarterly', label: 'Cada 3 meses' },
  { value: 'semiannual', label: 'Cada 6 meses' },
  { value: 'yearly', label: 'Cada año' },
  { value: 'custom', label: 'Personalizado' },
];

interface RepeatPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onCustom: () => void;
}

export function RepeatPicker({ open, onOpenChange, value, onChange, onCustom }: RepeatPickerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-center">Repetir</SheetTitle>
        </SheetHeader>
        <div className="divide-y divide-border mt-4">
          {PRESETS.map(p => (
            <button
              key={p.value}
              className="flex items-center justify-between w-full py-3 px-2 text-left hover:bg-muted/50 transition-colors"
              onClick={() => {
                if (p.value === 'custom') {
                  onCustom();
                } else {
                  onChange(p.value);
                }
                onOpenChange(false);
              }}
            >
              <span className="text-sm">{p.label}</span>
              {value === p.value && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function getRepeatLabel(preset: string | null): string {
  if (!preset || preset === 'never') return 'Nunca';
  const found = PRESETS.find(p => p.value === preset);
  return found?.label || 'Personalizado';
}
