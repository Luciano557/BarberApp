// Mapeo determinístico de barbero -> token semántico de color
const PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--accent-foreground))',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#ec4899',
];

export function useBarberColors(barberIds: string[]): Record<string, string> {
  const sorted = [...barberIds].sort();
  const map: Record<string, string> = {};
  sorted.forEach((id, i) => {
    map[id] = PALETTE[i % PALETTE.length];
  });
  return map;
}
