import { isValidHex } from '@/hooks/usePortalConfig';

/**
 * Convert a #RRGGBB hex to the "H S% L%" string used by shadcn/Tailwind tokens.
 */
export function hexToHslString(hex: string): string | null {
  if (!isValidHex(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Pick black or white foreground based on luminance.
 */
function pickForeground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '0 0% 10%' : '0 0% 100%';
}

/**
 * Build the inline style object that scopes the portal theme to its container.
 * - Overrides --primary and --ring (HSL strings) so all shadcn primary classes
 *   reflect the configured brand color across the whole booking flow.
 * - Adds --portal-primary (raw hex) for places that already use it inline.
 *
 * If no valid color is provided, returns an empty style (default theme).
 */
export function getPortalThemeStyle(primaryHex: string | null | undefined): React.CSSProperties {
  if (!isValidHex(primaryHex)) return {};
  const hex = primaryHex as string;
  const hsl = hexToHslString(hex);
  if (!hsl) return {};
  return {
    ['--primary' as any]: hsl,
    ['--primary-foreground' as any]: pickForeground(hex),
    ['--ring' as any]: hsl,
    ['--portal-primary' as any]: hex,
  };
}
