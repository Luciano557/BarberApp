import { afterEach, describe, expect, it } from 'vitest';
import { todayLocalIso } from '@/hooks/useBarberosSucursales';
import { resetBrowserClock, setBrowserClock } from '@/test/browserClock';
import { todayInTimezoneIso } from './dateUtils';
import { describePausa, pierdePertenenciaAlMoverPrincipal, pierdePertenenciaAlQuitar, sostienePertenencia, textoAvisoPausa, type AsignacionBarbero } from './tareasAutomaticas';

describe('describePausa', () => {
  it('distingue la pausa manual de las automáticas', () => {
    expect(describePausa('manual')).toMatchObject({ label: 'Pausada manualmente', automatica: false });
    expect(describePausa(null)).toMatchObject({ automatica: false });
    for (const motivo of ['sucursal_inactiva', 'barbero_inactivo', 'barbero_sin_asignacion']) {
      expect(describePausa(motivo).automatica).toBe(true);
    }
  });

  it('explica por qué está pausada y cuándo se reanuda', () => {
    expect(describePausa('sucursal_inactiva').label).toBe('Sucursal inactiva');
    expect(describePausa('barbero_inactivo').label).toBe('Barbero inactivo');
    expect(describePausa('barbero_sin_asignacion').label).toBe('Barbero sin asignación en la sucursal');
    expect(describePausa('sucursal_inactiva').hint).toMatch(/se reanuda sola/i);
  });
});

describe('textoAvisoPausa', () => {
  it('no avisa cuando no hay Tareas automáticas afectadas', () => {
    expect(textoAvisoPausa('sucursal', 0)).toBeNull();
    expect(textoAvisoPausa('barbero', -1)).toBeNull();
  });

  it('usa singular y plural y la terminología "Tareas automáticas"', () => {
    expect(textoAvisoPausa('sucursal', 1)).toBe('1 Tarea automática de esta sucursal se pausará. Se reanudará sola cuando la sucursal vuelva a estar activa.');
    expect(textoAvisoPausa('barbero', 3)).toBe('3 Tareas automáticas asignadas a esta persona se pausarán. Se reanudarán solas si la persona vuelve a estar activa.');
    expect(textoAvisoPausa('asignacion', 2)).toContain('en esta sucursal');
  });

  it('nunca menciona "recurrencias"', () => {
    for (const tipo of ['sucursal', 'barbero', 'asignacion'] as const) {
      expect(textoAvisoPausa(tipo, 2)).not.toMatch(/recurren/i);
    }
  });
});

const HOY = '2026-10-12';
const fila = (id: string, tipo: string, suc = 'S1', ini: string | null = null, fin: string | null = null): AsignacionBarbero =>
  ({ id, tipo, sucursal_id: suc, fecha_inicio: ini, fecha_fin: fin });

describe('sostienePertenencia (misma regla que la base; la disponibilidad diaria no participa)', () => {
  it('principal y recurrente cuentan mientras exista la fila', () => {
    expect(sostienePertenencia(fila('a', 'principal'), HOY)).toBe(true);
    expect(sostienePertenencia(fila('a', 'recurrente'), HOY)).toBe(true);
  });
  it('una temporal cuenta solo dentro de su rango; sin inicio ya empezó; futura y vencida no cuentan', () => {
    expect(sostienePertenencia(fila('a', 'temporal', 'S1', '2026-10-10', '2026-10-14'), HOY)).toBe(true);
    expect(sostienePertenencia(fila('a', 'temporal', 'S1', null, '2026-10-12'), HOY)).toBe(true);
    expect(sostienePertenencia(fila('a', 'temporal', 'S1', '2026-10-13', '2026-10-20'), HOY)).toBe(false);
    expect(sostienePertenencia(fila('a', 'temporal', 'S1', '2026-10-01', '2026-10-11'), HOY)).toBe(false);
    expect(sostienePertenencia(fila('a', 'temporal', 'S1', null, null), HOY)).toBe(false);
  });
});

describe('pierdePertenenciaAlQuitar (aviso al eliminar una asignación)', () => {
  it('avisa solo si era la última asignación vigente del par', () => {
    expect(pierdePertenenciaAlQuitar([fila('r', 'recurrente')], 'r', HOY)).toBe(true);
    expect(pierdePertenenciaAlQuitar([fila('p', 'principal'), fila('r', 'recurrente')], 'r', HOY)).toBe(false);
  });
  it('otra asignación futura o vencida no sostiene la pertenencia actual', () => {
    const futura = fila('t1', 'temporal', 'S1', '2026-11-01', '2026-11-05');
    const vencida = fila('t2', 'temporal', 'S1', '2026-09-01', '2026-09-05');
    expect(pierdePertenenciaAlQuitar([fila('r', 'recurrente'), futura, vencida], 'r', HOY)).toBe(true);
  });
  it('quitar una fila que ya no contaba (temporal vencida) no cambia nada', () => {
    expect(pierdePertenenciaAlQuitar([fila('v', 'temporal', 'S1', '2026-09-01', '2026-09-05')], 'v', HOY)).toBe(false);
  });
});

describe('pierdePertenenciaAlMoverPrincipal (aviso al cambiar la sucursal principal)', () => {
  it('avisa si la sucursal que deja no conserva otra asignación vigente', () => {
    expect(pierdePertenenciaAlMoverPrincipal([fila('p', 'principal', 'S1')], 'S1', HOY)).toBe(true);
  });
  it('no avisa si conserva una recurrente o una temporal vigente allí', () => {
    expect(pierdePertenenciaAlMoverPrincipal([fila('p', 'principal', 'S1'), fila('r', 'recurrente', 'S1')], 'S1', HOY)).toBe(false);
    expect(pierdePertenenciaAlMoverPrincipal([fila('p', 'principal', 'S1'), fila('t', 'temporal', 'S1', null, '2026-10-30')], 'S1', HOY)).toBe(false);
  });
  it('las asignaciones de otras sucursales no cuentan para la que se deja', () => {
    expect(pierdePertenenciaAlMoverPrincipal([fila('p', 'principal', 'S1'), fila('r', 'recurrente', 'S2')], 'S1', HOY)).toBe(true);
  });
});

describe('vigencia de temporales con el "hoy" de la organización (coincide con la base, no con el navegador)', () => {
  afterEach(resetBrowserClock);

  const BA = 'America/Argentina/Buenos_Aires'; // UTC-3
  const AUCKLAND = 'Pacific/Auckland'; // UTC+13 en octubre
  // 2026-10-13T02:00Z = 12/10 23:00 en Buenos Aires y 13/10 15:00 en Auckland.
  // 2026-10-12T20:00Z = 12/10 17:00 en Buenos Aires y 13/10 09:00 en Auckland.
  const casos: Array<[string, string, string, string, string | null, string | null, boolean]> = [
    // descripción, zona de la organización, zona del navegador, instante, inicio, fin, ¿sostiene la pertenencia?
    ['vence en el límite: hoy es su último día en la organización', BA, AUCKLAND, '2026-10-13T02:00:00Z', null, '2026-10-12', true],
    ['venció ayer en la organización aunque el navegador todavía esté en ese día', AUCKLAND, BA, '2026-10-12T20:00:00Z', null, '2026-10-12', false],
    ['empieza en el límite: hoy es su primer día en la organización', AUCKLAND, BA, '2026-10-12T20:00:00Z', '2026-10-13', '2026-10-20', true],
    ['empieza mañana en la organización aunque el navegador ya esté en ese día', BA, AUCKLAND, '2026-10-13T02:00:00Z', '2026-10-13', '2026-10-20', false],
  ];

  it.each(casos)('%s', (_desc, zonaOrg, zonaNavegador, instante, ini, fin, esperado) => {
    setBrowserClock(zonaNavegador, instante);
    const hoyOrg = todayInTimezoneIso(zonaOrg);
    const hoyNavegador = todayLocalIso();
    expect(hoyOrg).not.toBe(hoyNavegador); // el navegador y la organización están en días distintos
    const temporal = fila('t', 'temporal', 'S1', ini, fin);
    expect(sostienePertenencia(temporal, hoyOrg)).toBe(esperado);
    // Con la fecha del navegador la respuesta sería la contraria: el aviso tiene que usar la de la organización.
    expect(sostienePertenencia(temporal, hoyNavegador)).toBe(!esperado);
  });

  it('principal y recurrente dan lo mismo con cualquiera de los dos días', () => {
    setBrowserClock(AUCKLAND, '2026-10-13T02:00:00Z');
    for (const hoy of [todayInTimezoneIso(BA), todayLocalIso()]) {
      expect(sostienePertenencia(fila('p', 'principal'), hoy)).toBe(true);
      expect(sostienePertenencia(fila('r', 'recurrente'), hoy)).toBe(true);
    }
  });

  it('los avisos de quitar y de mover la principal usan el día de la organización', () => {
    setBrowserClock(AUCKLAND, '2026-10-13T02:00:00Z');
    const hoyOrg = todayInTimezoneIso(BA); // 2026-10-12; el navegador diría 2026-10-13
    // La temporal vence hoy en la organización: sigue sosteniendo la pertenencia.
    const venceHoy = fila('t', 'temporal', 'S1', null, '2026-10-12');
    expect(pierdePertenenciaAlQuitar([fila('r', 'recurrente'), venceHoy], 'r', hoyOrg)).toBe(false);
    expect(pierdePertenenciaAlQuitar([fila('r', 'recurrente'), venceHoy], 'r', todayLocalIso())).toBe(true);
    expect(pierdePertenenciaAlMoverPrincipal([fila('p', 'principal', 'S1'), venceHoy], 'S1', hoyOrg)).toBe(false);
    expect(pierdePertenenciaAlMoverPrincipal([fila('p', 'principal', 'S1'), venceHoy], 'S1', todayLocalIso())).toBe(true);
  });
});
