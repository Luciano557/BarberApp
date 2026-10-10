import { describe, expect, it } from 'vitest';
import {
  isFullyUsable,
  isTabActivation,
  navInset,
  navInsets,
  pageScrollLeft,
  resolveFocusHandoff,
  revealScrollLeft,
  scrollBehaviorFor,
  usableRange,
  type StripMetrics,
  type TargetRect,
} from './nav-strip';

// Finanzas a 375px: 5 tabs (posiciones en coordenadas de contenido, gap 16px),
// tira de 343px con 533px de contenido → 190px de recorrido.
const FINANZAS: TargetRect[] = [
  { left: 0, right: 113 }, // Estadisticas
  { left: 129, right: 214 }, // Sueldos
  { left: 230, right: 309 }, // Gastos
  { left: 325, right: 434 }, // Inversiones
  { left: 450, right: 533 }, // Deudas
];
const finanzas = (scrollLeft: number): StripMetrics => ({ scrollLeft, clientWidth: 343, scrollWidth: 533 });
const md = navInsets('md'); // 40px por lado

// SectionNav de 7 destinos (90px + gap 4) en la misma tira, inset sm = 36px.
const SECTIONS: TargetRect[] = Array.from({ length: 7 }, (_, i) => ({ left: i * 94, right: i * 94 + 90 }));
const sections = (scrollLeft: number): StripMetrics => ({ scrollLeft, clientWidth: 343, scrollWidth: 7 * 94 - 4 });
const sm = navInsets('sm');

describe('nav-strip · insets', () => {
  it('botón + cola', () => {
    expect(navInset('md')).toBe(40);
    expect(navInset('sm')).toBe(36);
  });

  it('el área útil solo descuenta una flecha donde hay contenido detrás', () => {
    expect(usableRange(0, finanzas(0), md)).toEqual({ start: 0, end: 303 });
    expect(usableRange(90, finanzas(90), md)).toEqual({ start: 130, end: 393 });
    expect(usableRange(190, finanzas(190), md)).toEqual({ start: 230, end: 533 });
  });
});

describe('nav-strip · revealScrollLeft (destino activo)', () => {
  it('destino ya visible → no mueve', () => {
    expect(revealScrollLeft(FINANZAS[0], finanzas(0), md)).toBe(0);
    expect(revealScrollLeft(FINANZAS[1], finanzas(0), md)).toBe(0);
    expect(isFullyUsable(FINANZAS[1], finanzas(0), md)).toBe(true);
  });

  it('destino oculto a la derecha (Deudas) → llega al extremo derecho sin inset derecho', () => {
    expect(revealScrollLeft(FINANZAS[4], finanzas(0), md)).toBe(190);
  });

  it('destino parcial a la derecha (Inversiones) → queda antes de la flecha derecha', () => {
    const next = revealScrollLeft(FINANZAS[3], finanzas(0), md);
    expect(next).toBe(131);
    const u = usableRange(next, finanzas(next), md);
    expect(FINANZAS[3].right).toBeLessThanOrEqual(u.end);
  });

  it('destino tapado por la flecha izquierda → se mueve hasta dejar de estar tapado', () => {
    // Con scrollLeft 190, Sueldos (129–214) queda a la izquierda del área útil (desde 230).
    expect(isFullyUsable(FINANZAS[1], finanzas(190), md)).toBe(false);
    const next = revealScrollLeft(FINANZAS[1], finanzas(190), md);
    expect(next).toBe(89);
    expect(FINANZAS[1].left).toBeGreaterThanOrEqual(usableRange(next, finanzas(next), md).start);
  });

  it('destino en el extremo izquierdo → clamp a 0 (sin flecha izquierda no hace falta inset)', () => {
    expect(revealScrollLeft(FINANZAS[0], finanzas(190), md)).toBe(0);
  });

  it('destino apenas debajo de la flecha izquierda a mitad de recorrido → se corre lo mínimo', () => {
    const m = finanzas(100);
    const target: TargetRect = { left: 120, right: 200 }; // 120 < 100 + 40
    expect(revealScrollLeft(target, m, md)).toBe(80);
  });

  it('no supera nunca el recorrido máximo ni baja de 0', () => {
    for (const t of FINANZAS) {
      for (const sl of [0, 50, 100, 190]) {
        const next = revealScrollLeft(t, finanzas(sl), md);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThanOrEqual(190);
      }
    }
  });

  it('un destino más ancho que el área útil prioriza su inicio', () => {
    const wide: TargetRect = { left: 100, right: 500 };
    const next = revealScrollLeft(wide, { scrollLeft: 0, clientWidth: 343, scrollWidth: 800 }, md);
    expect(next).toBe(60); // 100 - 40
  });

  it('sin overflow no se mueve', () => {
    const m: StripMetrics = { scrollLeft: 0, clientWidth: 343, scrollWidth: 343 };
    expect(revealScrollLeft({ left: 200, right: 340 }, m, md)).toBe(0);
  });
});

describe('nav-strip · pageScrollLeft (flechas)', () => {
  it('derecha desde el inicio: el primer destino no completo (Gastos) queda alineado al inicio útil', () => {
    // 230 - 40 = 190 → coincide con el recorrido máximo.
    expect(pageScrollLeft('end', finanzas(0), md, FINANZAS)).toBe(190);
  });

  it('izquierda desde el final: el último destino no completo (Sueldos) queda alineado al final útil', () => {
    expect(pageScrollLeft('start', finanzas(190), md, FINANZAS)).toBe(0);
  });

  it('SectionNav de 7 destinos: páginas sucesivas hacia la derecha', () => {
    const first = pageScrollLeft('end', sections(0), sm, SECTIONS);
    expect(first).toBe(246); // destino 3 (282) - 36
    const second = pageScrollLeft('end', sections(first), sm, SECTIONS);
    expect(second).toBe(311); // destino 5 (470) - 36 = 434 → clamp al máximo (311)
  });

  it('SectionNav: izquierda desde el final muestra el bloque anterior completo', () => {
    const next = pageScrollLeft('start', sections(311), sm, SECTIONS);
    expect(next).toBe(65); // destino 3 (right 372) - 343 + 36
    expect(isFullyUsable(SECTIONS[3], sections(next), sm)).toBe(true);
    expect(SECTIONS[4].left).toBeGreaterThan(usableRange(next, sections(next), sm).end - 1);
  });

  it('nunca deja un destino a medias: el resultado alinea un borde de destino o un extremo', () => {
    let sl = 0;
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) {
      const next = pageScrollLeft('end', sections(sl), sm, SECTIONS);
      seen.push(next);
      if (next === sl) break;
      sl = next;
    }
    const max = 7 * 94 - 4 - 343;
    for (const v of seen) {
      const alignsTarget = SECTIONS.some((t) => Math.abs(v + sm.start - t.left) < 1);
      expect(alignsTarget || v === max).toBe(true);
    }
    expect(sl).toBe(max);
  });

  it('en los extremos no se queda pegada: derecha en el máximo y izquierda en 0 no se mueven', () => {
    expect(pageScrollLeft('end', finanzas(190), md, FINANZAS)).toBe(190);
    expect(pageScrollLeft('start', finanzas(0), md, FINANZAS)).toBe(0);
  });

  it('un destino más ancho que el área útil avanza igualmente (una ventana útil)', () => {
    const m: StripMetrics = { scrollLeft: 0, clientWidth: 200, scrollWidth: 1000 };
    const targets: TargetRect[] = [{ left: 0, right: 500 }];
    const next = pageScrollLeft('end', m, navInsets('sm'), targets);
    expect(next).toBeGreaterThan(0);
  });
});

describe('nav-strip · reduced motion', () => {
  it('suave por defecto, instantáneo si se pidió reducir movimiento', () => {
    expect(scrollBehaviorFor(false)).toBe('smooth');
    expect(scrollBehaviorFor(true)).toBe('auto');
  });
});

describe('nav-strip · isTabActivation (auto-scroll del activo)', () => {
  it('solo cuando un tab pasa realmente a active', () => {
    expect(isTabActivation('inactive', 'active')).toBe(true);
    expect(isTabActivation(null, 'active')).toBe(true);
    expect(isTabActivation('active', 'active')).toBe(false);
    expect(isTabActivation('active', 'inactive')).toBe(false);
    expect(isTabActivation('inactive', 'inactive')).toBe(false);
    expect(isTabActivation('active', null)).toBe(false);
  });
});

describe('nav-strip · resolveFocusHandoff', () => {
  it('sin foco en una flecha, o con la flecha todavía visible → nada', () => {
    expect(resolveFocusHandoff(null, false, false)).toBeNull();
    expect(resolveFocusHandoff('end', true, true)).toBeNull();
    expect(resolveFocusHandoff('start', true, false)).toBeNull();
  });

  it('la flecha enfocada desaparece → pasa a la opuesta', () => {
    expect(resolveFocusHandoff('end', true, false)).toBe('start');
    expect(resolveFocusHandoff('start', false, true)).toBe('end');
  });

  it('desaparece el overflow completo → foco al destino activo', () => {
    expect(resolveFocusHandoff('end', false, false)).toBe('active');
    expect(resolveFocusHandoff('start', false, false)).toBe('active');
  });
});
