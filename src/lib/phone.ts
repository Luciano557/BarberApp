/**
 * Vittro — Utilidad central de teléfonos (wrapper oficial).
 *
 * Único punto de entrada para teléfonos en toda la app. Los componentes y
 * hooks NO deben importar `libphonenumber-js` directamente.
 *
 * Formato canónico AR: `+54XXXXXXXXXX` (12 dígitos tras el `+`), sin el `9`
 * intermedio. Alineado con el formato que quedó en DB tras la migración 2026-05
 * (se eliminó el `9` de móviles para usar el formato Google/libphonenumber base).
 *
 * Reglas AR (idempotentes):
 *   - 13 dígitos `549XXXXXXXXXX`            → `+54XXXXXXXXXX` (strip del 9)
 *   - 12 dígitos `54` + área(1|2|3) + 8     → `+54XXXXXXXXXX` (idempotente)
 *   - 13 dígitos `011 15 + 8`               → `+54 + area(2) + 8`
 *   - 10 dígitos nacionales (1|2|3...)      → `+54 + 10`
 *   - 11 dígitos `0` + (1|2|3) + ...        → `+54 + 10` (fijo nacional)
 *   - Empieza con `+` y no es `+54...`      → foreign (NO convertir)
 *   - Resto                                  → invalid
 *
 * WhatsApp: `buildWhatsAppNumber` reinyecta el `9` porque WhatsApp AR sigue
 * exigiendo `549XXXXXXXXXX`. No es contradictorio: el canónico de almacenamiento
 * es `+54...`, pero el destino WhatsApp requiere el `9`.
 *
 * Multi-país: para países distintos de AR se delega a `libphonenumber-js`.
 */

import { parsePhoneNumberFromString, type CountryCode as LibCountryCode } from 'libphonenumber-js/min';

export type CountryCode = 'AR' | 'MX' | 'ES' | 'BR' | 'UY' | 'CL' | 'CO';

export type CanonicalizeReason =
  | 'empty'
  | 'invalid'
  | 'foreign'
  | 'ambiguous_landline';

export type CanonicalizeResult =
  | { ok: true; e164: string }
  | { ok: false; reason: CanonicalizeReason };

const onlyDigits = (s: string): string => s.replace(/\D+/g, '');

// ---------------------------------------------------------------------------
// Argentina (reglas legacy + fallback libphonenumber-js)
// ---------------------------------------------------------------------------

export interface CanonicalizeOptions {
  defaultCountry?: CountryCode;
  /** Mantenido por compatibilidad. Ya no afecta el formato de salida AR. */
  allowLandline?: boolean;
}

export function canonicalizePhoneAR(
  input: unknown,
  _opts?: { allowLandline?: boolean },
): CanonicalizeResult {
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

  // 13 dígitos: 549 + 10 → strip del 9
  if (L === 13 && d.startsWith('549') && '123'.includes(d[3])) {
    return { ok: true, e164: '+54' + d.slice(3) };
  }

  // 12 dígitos: 54 + área(1|2|3) + 8 (formato canónico actual). Idempotente.
  if (L === 12 && d.startsWith('54') && '123'.includes(d[2])) {
    return { ok: true, e164: '+' + d };
  }

  // 13 dígitos antiguos: 011 15 + 8
  if (L === 13 && d.startsWith('011') && d.slice(3, 5) === '15') {
    return { ok: true, e164: '+54' + d.slice(1, 3) + d.slice(5) };
  }

  // 11 dígitos: 0 + área + 8 → fijo / móvil nacional con prefijo 0
  if (L === 11 && d[0] === '0' && '123'.includes(d[1])) {
    return { ok: true, e164: '+54' + d.slice(1) };
  }

  // 10 dígitos nacionales: área + abonado
  if (L === 10 && '123'.includes(d[0])) {
    return { ok: true, e164: '+54' + d };
  }

  // Fallback: libphonenumber-js como AR. Si devuelve +549..., strippeamos el 9.
  try {
    const pn = parsePhoneNumberFromString(raw, 'AR');
    if (pn && pn.isValid() && pn.country === 'AR') {
      const e164 = pn.number;
      if (e164.startsWith('+549')) return { ok: true, e164: '+54' + e164.slice(4) };
      if (e164.startsWith('+54')) return { ok: true, e164 };
    }
  } catch { /* noop */ }

  return { ok: false, reason: 'invalid' };
}

// ---------------------------------------------------------------------------
// Multi-país (delegado a libphonenumber-js)
// ---------------------------------------------------------------------------

export function canonicalizePhone(
  input: unknown,
  opts?: CanonicalizeOptions,
): CanonicalizeResult {
  const country = opts?.defaultCountry ?? 'AR';
  if (country === 'AR') return canonicalizePhoneAR(input, { allowLandline: !!opts?.allowLandline });

  if (input === null || input === undefined) return { ok: false, reason: 'empty' };
  const raw = String(input).trim();
  if (!raw) return { ok: false, reason: 'empty' };

  try {
    const pn = parsePhoneNumberFromString(raw, country as LibCountryCode);
    if (!pn) return { ok: false, reason: 'invalid' };
    if (!pn.isValid()) return { ok: false, reason: 'invalid' };
    return { ok: true, e164: pn.number };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export function isValidPhoneAR(input: unknown, opts?: { allowLandline?: boolean }): boolean {
  return canonicalizePhoneAR(input, opts).ok;
}

export function isValidPhone(input: unknown, country: CountryCode = 'AR', opts?: { allowLandline?: boolean }): boolean {
  return canonicalizePhone(input, { defaultCountry: country, allowLandline: opts?.allowLandline }).ok;
}

/**
 * Descompone un teléfono en código de área + abonado.
 * Para AR usa heurística simple (área = 2 dígitos por defecto).
 * Devuelve null si no es convertible.
 */
export function parsePhone(
  input: unknown,
  country: CountryCode = 'AR',
): { country: CountryCode; areaCode: string; subscriber: string; e164: string } | null {
  const r = canonicalizePhone(input, { defaultCountry: country });
  if (!r.ok) return null;
  try {
    const pn = parsePhoneNumberFromString(r.e164);
    if (pn) {
      const national = pn.nationalNumber as string;
      const areaLen = country === 'AR' ? Math.min(2, national.length) : Math.max(2, national.length - 7);
      return {
        country: (pn.country as CountryCode) ?? country,
        areaCode: national.slice(0, areaLen),
        subscriber: national.slice(areaLen),
        e164: r.e164,
      };
    }
  } catch { /* noop */ }
  return null;
}

export function parsePhoneAR(
  input: unknown,
): { areaCode: string; subscriber: string } | null {
  const p = parsePhone(input, 'AR');
  if (!p) return null;
  return { areaCode: p.areaCode, subscriber: p.subscriber };
}

/**
 * Formato humano tolerante.
 *   - null/undefined/''      → ''
 *   - E.164 AR móvil válido  → "+54 9 11 6959-9710"
 *   - E.164 AR fijo válido   → "+54 11 4555-1234" (sin el 9)
 *   - E.164 otro país        → formato internacional de libphonenumber-js
 *   - inválido/legacy        → string original (no rompe la UI)
 */
export function formatPhoneDisplay(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  const raw = String(input).trim();
  if (!raw) return '';

  // AR móvil canónico: +549 + 10 dígitos (13 dígitos tras el +).
  const digitsRaw = onlyDigits(raw);
  if (raw.startsWith('+549') && digitsRaw.length === 13) {
    const rest = digitsRaw.slice(3); // 10 dígitos
    const area = rest.slice(0, 2);
    const ab = rest.slice(2);
    return `+54 9 ${area} ${ab.slice(0, 4)}-${ab.slice(4)}`;
  }

  // AR fijo canónico: +54 + 10 dígitos (12 dígitos tras el +), no empieza con 9.
  if (raw.startsWith('+54') && !raw.startsWith('+549') && digitsRaw.length === 12) {
    const rest = digitsRaw.slice(2); // 10 dígitos
    const area = rest.slice(0, 2);
    const ab = rest.slice(2);
    return `+54 ${area} ${ab.slice(0, 4)}-${ab.slice(4)}`;
  }

  // Reintento AR como móvil (legacy: ingresan crudo).
  const rMobile = canonicalizePhoneAR(raw);
  if (rMobile.ok) {
    const rest = rMobile.e164.slice(4);
    const area = rest.slice(0, 2);
    const ab = rest.slice(2);
    return `+54 9 ${area} ${ab.slice(0, 4)}-${ab.slice(4)}`;
  }

  // Otros países: intentar parseo libre.
  try {
    const pn = parsePhoneNumberFromString(raw);
    if (pn && pn.isValid()) return pn.formatInternational();
  } catch { /* noop */ }

  // Último recurso: devolver tal cual para no romper la UI.
  return raw;
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
      return 'Revisá el teléfono. Ingresá código de área y número sin prefijos extra.';
  }
}
