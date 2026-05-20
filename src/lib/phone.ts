/**
 * Vittro — Utilidad central de teléfonos.
 *
 * Formato canónico móvil argentino: +549XXXXXXXXXX (13 dígitos después del '+').
 *
 * Reglas de canonicalización AR (idénticas a `_canon_phone_ar` en DB):
 *   - 13 dígitos `549XXXXXXXXXX`            → `+549XXXXXXXXXX`
 *   - 12 dígitos `54` + área(1|2|3) + 8     → `+549...`
 *   - 13 dígitos `011 15 + 8`               → `+549 + area(2) + 8`
 *   - 10 dígitos nacionales (1|2|3...)      → `+549 + 10`
 *   - 11 dígitos `0` + (1|2|3) + ...        → ambiguous_landline (NO convertir)
 *   - Empieza con `+` y no es `+54...`      → foreign (NO convertir)
 *   - Resto                                  → invalid
 *
 * La función es idempotente: aplicarla dos veces sobre un canónico devuelve el mismo valor.
 */

export type CanonicalizeReason =
  | 'empty'
  | 'invalid'
  | 'foreign'
  | 'ambiguous_landline';

export type CanonicalizeResult =
  | { ok: true; e164: string }
  | { ok: false; reason: CanonicalizeReason };

const onlyDigits = (s: string): string => s.replace(/\D+/g, '');

export function canonicalizePhoneAR(input: unknown): CanonicalizeResult {
  if (input === null || input === undefined) return { ok: false, reason: 'empty' };
  const raw = String(input).trim();
  if (!raw) return { ok: false, reason: 'empty' };

  // Foreign: '+' que no es +54
  if (raw.startsWith('+') && !raw.replace(/\s+/g, '').startsWith('+54')) {
    return { ok: false, reason: 'foreign' };
  }

  const d = onlyDigits(raw);
  const L = d.length;
  if (L === 0) return { ok: false, reason: 'invalid' };

  // 13 dígitos: 549XXXXXXXXXX (ya canónico)
  if (L === 13 && d.startsWith('549') && '123'.includes(d[3])) {
    return { ok: true, e164: '+' + d };
  }

  // 12 dígitos: 54 + área(1|2|3) + 8 (sin el 9 móvil)
  if (L === 12 && d.startsWith('54') && '123'.includes(d[2])) {
    return { ok: true, e164: '+549' + d.slice(2) };
  }

  // 13 dígitos antiguos: 011 15 + 8 → móvil
  if (L === 13 && d.startsWith('011') && d.slice(3, 5) === '15') {
    return { ok: true, e164: '+549' + d.slice(1, 3) + d.slice(5) };
  }

  // 11 dígitos: 0 + área(1|2|3) + 8 → posible fijo, no convertir
  if (L === 11 && d[0] === '0' && '123'.includes(d[1])) {
    return { ok: false, reason: 'ambiguous_landline' };
  }

  // 10 dígitos nacionales: área(1|2|3) + abonado
  if (L === 10 && '123'.includes(d[0])) {
    return { ok: true, e164: '+549' + d };
  }

  return { ok: false, reason: 'invalid' };
}

export function canonicalizePhone(
  input: unknown,
  opts?: { defaultCountry?: 'AR' },
): CanonicalizeResult {
  const country = opts?.defaultCountry ?? 'AR';
  if (country === 'AR') return canonicalizePhoneAR(input);
  return canonicalizePhoneAR(input);
}

export function isValidPhoneAR(input: unknown): boolean {
  return canonicalizePhoneAR(input).ok;
}

/**
 * Descompone un teléfono AR en código de área + abonado.
 * Devuelve null si no es convertible.
 */
export function parsePhoneAR(
  input: unknown,
): { areaCode: string; subscriber: string } | null {
  const r = canonicalizePhoneAR(input);
  if (!r.ok) return null;
  // e164: +549 + N (10 dígitos: área(1-4) + abonado)
  const rest = r.e164.slice(4); // quita +549
  // Heurística simple para Argentina: área 2 dígitos (más común CABA/GBA),
  // 3 ó 4 para interior. Para el formato canónico móvil AR los 10 dígitos
  // son siempre "área + abonado" donde área puede ser 2-4. Sin tabla de
  // áreas, devolvemos los 2 primeros como área por defecto y el resto como
  // abonado. El usuario puede ajustar visualmente si lo necesita.
  if (rest.length < 8) return null;
  const areaLen = rest.length === 10 ? 2 : Math.max(2, rest.length - 8);
  return {
    areaCode: rest.slice(0, areaLen),
    subscriber: rest.slice(areaLen),
  };
}

/**
 * Devuelve un formato humano: "+54 9 11 6959-9710".
 */
export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return '';
  const r = canonicalizePhoneAR(e164);
  if (!r.ok) return String(e164);
  const rest = r.e164.slice(4); // 10 dígitos
  const area = rest.slice(0, 2);
  const ab = rest.slice(2);
  const ab1 = ab.slice(0, 4);
  const ab2 = ab.slice(4);
  return `+54 9 ${area} ${ab1}-${ab2}`;
}

/**
 * Número estilo WhatsApp: 549XXXXXXXXXX (sin '+').
 */
export function buildWhatsAppNumber(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const r = canonicalizePhoneAR(e164);
  if (!r.ok) return null;
  return r.e164.replace(/^\+/, '');
}

/**
 * Link wa.me canónico. Devuelve null si el teléfono no es válido.
 */
export function buildWhatsAppLink(
  e164: string | null | undefined,
  text?: string,
): string | null {
  const n = buildWhatsAppNumber(e164);
  if (!n) return null;
  const base = `https://wa.me/${n}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Mensaje humano para errores controlados de canonicalización.
 */
export function phoneErrorMessage(reason: CanonicalizeReason): string {
  switch (reason) {
    case 'empty':
      return 'Ingresá un teléfono.';
    case 'foreign':
      return 'Ese número parece extranjero. Por ahora solo aceptamos teléfonos argentinos.';
    case 'ambiguous_landline':
      return 'Ese número parece un fijo. Ingresá un móvil con código de área y sin el 0 ni el 15.';
    case 'invalid':
    default:
      return 'Teléfono inválido. Ejemplo: 11 2516-2528.';
  }
}
