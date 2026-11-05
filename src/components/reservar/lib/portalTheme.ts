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
function luminance(hex: string): number {
  const linear = (offset: number) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const r = linear(1), g = linear(3), b = linear(5);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum;
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
  const lightBrand = luminance(hex) > 0.179;
  return {
    '--primary': hsl,
    '--primary-foreground': lightBrand ? '0 0% 0%' : '0 0% 100%',
    '--ring': lightBrand ? '232 75% 14%' : hsl,
    '--portal-accent-ink': lightBrand ? '232 75% 14%' : hsl,
    '--portal-primary': hex,
  } as React.CSSProperties;
}
