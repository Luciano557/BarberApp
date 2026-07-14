import { addDays, format } from 'date-fns';
import { timeToMinutes } from '@/components/agenda/lib/timeUtils';

export interface OcupacionHorario {
  dia_semana: number; // ISO: 1=Lun..7=Dom, mismo convenio que horarios_trabajo
  hora_inicio: string;
  hora_fin: string;
  barbero_id: string | null; // null = horario general de la sucursal (fallback)
}

export interface OcupacionBloqueo {
  fecha_inicio: string; // yyyy-MM-dd
  fecha_fin: string; // yyyy-MM-dd
  hora_inicio: string | null;
  hora_fin: string | null;
  todo_el_dia: boolean;
  barbero_id: string | null; // null = bloqueo de toda la sucursal
}

interface MinuteRange {
  start: number;
  end: number;
}

/** ISO day-of-week matching horarios_trabajo.dia_semana (1=Lun..7=Dom). Mismo cálculo que AgendaDayView. */
function isoDayOfWeek(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

function toMinuteRanges(horarios: OcupacionHorario[]): MinuteRange[] {
  return horarios
    .map((h) => ({ start: timeToMinutes(h.hora_inicio), end: timeToMinutes(h.hora_fin) }))
    .filter((r) => r.end > r.start);
}

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Todas las intersecciones no vacías entre dos listas de rangos (en minutos). */
function intersectRanges(a: MinuteRange[], b: MinuteRange[]): MinuteRange[] {
  const result: MinuteRange[] = [];
  for (const ra of a) {
    for (const rb of b) {
      const start = Math.max(ra.start, rb.start);
      const end = Math.min(ra.end, rb.end);
      if (end > start) result.push({ start, end });
    }
  }
  return result;
}

/**
 * Rangos horarios efectivos (en minutos) de un barbero para un día de semana dado.
 *
 * Regla de negocio: un horario individual solo puede RECORTAR el horario general de la
 * sucursal, nunca extenderlo. Si existe un override para ese barbero/día, el resultado es
 * la intersección entre el override y el horario general de ese mismo día — nunca el
 * override "tal cual". Si el override cae completamente fuera del horario general (dato
 * mal cargado), el resultado es vacío (0 horas ese día para ese barbero), no el override
 * completo.
 */
function getEffectiveRanges(horarios: OcupacionHorario[], barberoId: string, dow: number): MinuteRange[] {
  const overrides = horarios.filter((h) => h.barbero_id === barberoId && h.dia_semana === dow);
  const general = horarios.filter((h) => h.barbero_id === null && h.dia_semana === dow);
  if (overrides.length === 0) return toMinuteRanges(general);
  return intersectRanges(toMinuteRanges(overrides), toMinuteRanges(general));
}

/** Minutos netos disponibles de un barbero en un día puntual (horario aplicable menos bloqueos vigentes). */
function netMinutesForBarberDay(
  horarios: OcupacionHorario[],
  bloqueos: OcupacionBloqueo[],
  barberoId: string,
  date: Date,
): number {
  const dow = isoDayOfWeek(date);
  const effective = getEffectiveRanges(horarios, barberoId, dow);
  if (effective.length === 0) return 0;

  const dateStr = format(date, 'yyyy-MM-dd');
  const dayBloqueos = bloqueos.filter(
    (b) => (b.barbero_id === barberoId || b.barbero_id === null) && b.fecha_inicio <= dateStr && b.fecha_fin >= dateStr,
  );

  let net = 0;
  for (const { start: hStart, end: hEnd } of effective) {
    const gross = hEnd - hStart;
    let blocked = 0;
    for (const b of dayBloqueos) {
      if (b.todo_el_dia || !b.hora_inicio || !b.hora_fin) {
        blocked += gross;
      } else {
        blocked += overlapMinutes(hStart, hEnd, timeToMinutes(b.hora_inicio), timeToMinutes(b.hora_fin));
      }
    }
    net += Math.max(0, gross - blocked);
  }
  return net;
}

/** Horas-silla disponibles del local entero (todos los barberoIds) en un rango de fechas inclusive. */
export function computeHorasDisponibles(
  horarios: OcupacionHorario[],
  bloqueos: OcupacionBloqueo[],
  barberoIds: string[],
  rangeStart: Date,
  rangeEnd: Date,
): number {
  if (barberoIds.length === 0 || rangeStart > rangeEnd) return 0;
  let totalMinutes = 0;
  let cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    for (const barberoId of barberoIds) {
      totalMinutes += netMinutesForBarberDay(horarios, bloqueos, barberoId, cursor);
    }
    cursor = addDays(cursor, 1);
  }
  return totalMinutes / 60;
}

/**
 * true si algún barbero activo no tiene NINGÚN horario aplicable (ni propio ni el general de la
 * sucursal) en ningún día de la semana — ese barbero aporta 0 horas al denominador por falta de dato,
 * no porque el local esté cerrado. Señal de "cobertura de horarios incompleta".
 */
export function hasCoberturaIncompleta(horarios: OcupacionHorario[], barberoIds: string[]): boolean {
  return barberoIds.some((id) => {
    const tieneAlgunDia = [1, 2, 3, 4, 5, 6, 7].some((dow) => getEffectiveRanges(horarios, id, dow).length > 0);
    return !tieneAlgunDia;
  });
}
