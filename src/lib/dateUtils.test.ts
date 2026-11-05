import { afterEach, describe, expect, it } from 'vitest';
import { resetBrowserClock, setBrowserClock } from '@/test/browserClock';
import { buildGoogleCalendarUrl, todayInTimezoneIso } from './dateUtils';

const BA = 'America/Argentina/Buenos_Aires';
const MAD = 'Europe/Madrid';

afterEach(resetBrowserClock);

describe('el calendario conserva la hora de la barbería', () => {
  it.each(['Pacific/Auckland', 'Pacific/Honolulu', 'UTC', BA])('10:00 en Buenos Aires son 13:00 UTC desde %s', navegador => {
    setBrowserClock(navegador, '2026-11-05T12:00:00Z');
    const url = new URL(buildGoogleCalendarUrl({ title: 'Turno', description: 'Corte', location: 'Centro', fecha: '2026-11-06', horaInicio: '10:00', horaFin: '10:30', timezone: BA }));
    expect(url.searchParams.get('dates')).toBe('20261106T130000Z/20261106T133000Z');
  });
  it.each([
    ['2026-01-15', '20260115T090000Z/20260115T093000Z'],
    ['2026-07-15', '20260715T080000Z/20260715T083000Z'],
  ])('respeta el horario estacional de Madrid el %s', (fecha, expected) => {
    const url = new URL(buildGoogleCalendarUrl({ title: 'Turno', description: 'Corte', location: 'Centro', fecha, horaInicio: '10:00', horaFin: '10:30', timezone: MAD }));
    expect(url.searchParams.get('dates')).toBe(expected);
  });
});

// Mismos instantes y mismos días que afirma supabase/tests/tareas-automaticas-sql.mjs sobre public._tareas_auto_hoy(org, now):
// lo que la base llama "hoy" para una organización es lo que esta función devuelve para su zona horaria.
const VECTORES_DE_LA_BASE: Array<[string, string, string]> = [
  [BA, '2026-10-13T01:00:00Z', '2026-10-12'],
  [MAD, '2026-10-13T01:00:00Z', '2026-10-13'],
  [BA, '2026-10-13T02:59:59Z', '2026-10-12'],
  [BA, '2026-10-13T03:00:00Z', '2026-10-13'],
  [MAD, '2026-10-12T21:59:59Z', '2026-10-12'],
  [MAD, '2026-10-12T22:00:00Z', '2026-10-13'],
];

describe('todayInTimezoneIso · el mismo "hoy" que calcula la base con organizations.timezone', () => {
  it.each(VECTORES_DE_LA_BASE)('%s a las %s → %s', (tz, instante, esperado) => {
    expect(todayInTimezoneIso(tz, new Date(instante))).toBe(esperado);
  });

  it.each([['Mars/Phobos'], [''], [null], [undefined]])('zona %p (inválida o ausente) → Buenos Aires, como la base', tz => {
    expect(todayInTimezoneIso(tz, new Date('2026-10-13T01:00:00Z'))).toBe('2026-10-12');
  });

  it.each(['Pacific/Auckland', 'Pacific/Honolulu', 'UTC'])('no depende de la zona horaria del navegador (%s)', navegador => {
    setBrowserClock(navegador, '2026-10-13T01:00:00Z');
    expect(todayInTimezoneIso(BA)).toBe('2026-10-12');
    expect(todayInTimezoneIso(MAD)).toBe('2026-10-13');
  });
});
