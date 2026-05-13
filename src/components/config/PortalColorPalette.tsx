import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface PortalColorPreset {
  name: string;
  hex: string;
}

export const PORTAL_COLOR_PRESETS: PortalColorPreset[] = [
  { name: 'Negro', hex: '#0A0A0A' },
  { name: 'Gris oscuro', hex: '#374151' },
  { name: 'Azul barbería', hex: '#1E40AF' },
  { name: 'Verde', hex: '#16A34A' },
  { name: 'Rojo', hex: '#DC2626' },
  { name: 'Ámbar', hex: '#D97706' },
  { name: 'Púrpura', hex: '#7C3AED' },
  { name: 'Rosa', hex: '#DB2777' },
  { name: 'Teal', hex: '#0D9488' },
  { name: 'Marrón', hex: '#78350F' },
];

interface Props {
  value: string | null;
  onChange: (hex: string) => void;
}

export function PortalColorPalette({ value, onChange }: Props) {
  const current = (value || '').toUpperCase();
  return (
    <div className="flex flex-wrap gap-2">
      {PORTAL_COLOR_PRESETS.map((c) => {
        const selected = current === c.hex.toUpperCase();
        return (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            title={c.name}
            aria-label={c.name}
            className={cn(
              'relative h-9 w-9 rounded-full border border-border/60 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              selected && 'ring-2 ring-ring ring-offset-2'
            )}
            style={{ backgroundColor: c.hex }}
          >
            {selected && (
              <Check
                className="absolute inset-0 m-auto h-4 w-4"
                style={{ color: '#fff', mixBlendMode: 'difference' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
