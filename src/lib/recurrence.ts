import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

/**
 * Calcula la próxima fecha de ocurrencia a partir de la fecha actual
 * y la configuración de repetición (preset + custom).
 *
 * Mantiene exactamente el comportamiento original implementado en
 * useGastosRecurrentes para que tanto gastos como tareas recurrentes
 * usen la misma lógica.
 */
export function calcNextDate(
  current: Date,
  preset: string,
  frequency?: string | null,
  interval?: number | null,
  byweekday?: number[] | null,
): Date {
  const n = interval || 1;

  switch (preset) {
    case 'daily':
      return addDays(current, 1);
    case 'weekdays': {
      let next = addDays(current, 1);
      while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
      return next;
    }
    case 'weekends': {
      let next = addDays(current, 1);
      while (next.getDay() !== 0 && next.getDay() !== 6) next = addDays(next, 1);
      return next;
    }
    case 'weekly':
      return addWeeks(current, 1);
    case 'biweekly':
      return addWeeks(current, 2);
    case 'monthly':
      return addMonths(current, 1);
    case 'quarterly':
      return addMonths(current, 3);
    case 'semiannual':
      return addMonths(current, 6);
    case 'yearly':
      return addYears(current, 1);
    case 'custom': {
      const freq = frequency || 'monthly';
      switch (freq) {
        case 'daily':
          return addDays(current, n);
        case 'weekly': {
          if (byweekday?.length) {
            const sorted = [...byweekday].sort((a, b) => a - b);
            const currentDay = current.getDay();
            const nextDay = sorted.find(d => d > currentDay);
            if (nextDay !== undefined) {
              return addDays(current, nextDay - currentDay);
            }
            // Wrap to next week cycle
            const daysUntilFirst = 7 * (n - 1) + (7 - currentDay + sorted[0]);
            return addDays(current, daysUntilFirst);
          }
          return addWeeks(current, n);
        }
        case 'monthly':
          return addMonths(current, n);
        case 'yearly':
          return addYears(current, n);
        default:
          return addMonths(current, n);
      }
    }
    default:
      return addMonths(current, 1);
  }
}
