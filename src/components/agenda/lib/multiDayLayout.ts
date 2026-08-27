import { timeToMinutes } from './timeUtils';
import { Turno } from '../hooks/useAgendaData';

export const MULTI_PX_PER_MIN = 1.9;
export const MULTI_RANGE_START = 8 * 60;
export const MULTI_RANGE_END = 22 * 60;

export function buildHourRails(rangeStart: number, rangeEnd: number): number[] {
  const rails: number[] = [];
  for (let m = rangeStart; m <= rangeEnd; m += 60) rails.push(m);
  return rails;
}

export function buildHalfHourRails(rangeStart: number, rangeEnd: number): number[] {
  const rails: number[] = [];
  for (let m = rangeStart; m <= rangeEnd; m += 30) {
    if (m % 60 !== 0) rails.push(m);
  }
  return rails;
}

export function computeLayouts(items: Turno[]) {
  const sorted = [...items].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  const groups: Turno[][] = [];

  sorted.forEach((t) => {
    const tStart = timeToMinutes(t.hora_inicio);
    const tEnd = timeToMinutes(t.hora_fin);
    let placed = false;

    for (const g of groups) {
      const overlaps = g.some((x) => {
        const xs = timeToMinutes(x.hora_inicio);
        const xe = timeToMinutes(x.hora_fin);
        return tStart < xe && xs < tEnd;
      });
      if (overlaps) {
        g.push(t);
        placed = true;
        break;
      }
    }

    if (!placed) groups.push([t]);
  });

  const result = new Map<string, { idx: number; count: number }>();
  groups.forEach((g) => {
    g.forEach((t, i) => result.set(t.id, { idx: i, count: g.length }));
  });
  return result;
}
