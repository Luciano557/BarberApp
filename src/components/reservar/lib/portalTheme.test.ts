import { describe, expect, it } from 'vitest';
import { getPortalThemeStyle } from './portalTheme';

const luminance = (hex: string) => {
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};

describe('contraste del portal white-label', () => {
  it.each(['#000000', '#ffffff', '#ffff00', '#00ff00', '#ff0000', '#0000ff', '#777777', '#767676', '#879969', '#18a89b'])('mantiene texto de acción AA con %s', hex => {
    const style = getPortalThemeStyle(hex) as Record<string, string>;
    const background = luminance(hex);
    const foreground = style['--primary-foreground'] === '0 0% 100%' ? 1 : 0;
    expect((Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05)).toBeGreaterThanOrEqual(4.5);
  });
  it('usa tinta y foco oscuros sobre marcas claras sin perder el color de la acción', () => {
    const style = getPortalThemeStyle('#ffff00') as Record<string, string>;
    expect(style['--portal-primary']).toBe('#ffff00');
    expect(style['--ring']).toBe('232 75% 14%');
    expect(style['--portal-accent-ink']).toBe('232 75% 14%');
  });
  it('conserva el tema heredado con un color inválido', () => {
    expect(getPortalThemeStyle('invalid')).toEqual({});
  });
});
