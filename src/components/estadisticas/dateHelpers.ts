import { getDaysInMonth, getDay } from 'date-fns';

export function getWorkDaysInMonth(year: number, month: number): number {
  const daysInMonth = getDaysInMonth(new Date(year, month));
  let workDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = getDay(new Date(year, month, d));
    if (day !== 0) workDays++;
  }
  return workDays;
}

export function getWorkDaysUpTo(year: number, month: number, maxDay: number): number {
  const daysInMonth = getDaysInMonth(new Date(year, month));
  const limit = Math.min(maxDay, daysInMonth);
  let workDays = 0;
  for (let d = 1; d <= limit; d++) {
    const day = getDay(new Date(year, month, d));
    if (day !== 0) workDays++;
  }
  return workDays;
}

export function calcVariation(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
