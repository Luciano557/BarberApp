import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptySelectHintProps {
  message: string;
  ctaLabel: string;
  onCta: () => void;
}

/** Mensaje + CTA para Selects sin ítems disponibles (mismo patrón que Cobrar). */
export function EmptySelectHint({ message, ctaLabel, onCta }: EmptySelectHintProps) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
        <Info className="h-3.5 w-3.5" />
        <p className="text-xs">{message}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onCta}>
        {ctaLabel}
      </Button>
    </div>
  );
}
