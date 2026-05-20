// Normalization helpers for client import
import { canonicalizePhoneAR, type CanonicalizeReason } from '@/lib/phone';

/**
 * Resultado enriquecido para teléfonos de importación.
 */
export interface ImportPhoneResult {
  display: string | null;
  dedupKey: string | null;
  needsReview: boolean;
  reason?: CanonicalizeReason;
}

/**
 * Procesa un teléfono importado aplicando la canonicalización central.
 * - Convertibles AR → guardar canónico `+549...` y usar como clave de dedup.
 * - Extranjeros → conservar string limpio sin transformar, dedup por dígitos, marcar revisión.
 * - Ambiguos (posible fijo 011...) → conservar limpio, marcar revisión.
 * - Inválidos / vacíos → no guardar, sin dedup por teléfono.
 */
export function processImportPhone(input: unknown): ImportPhoneResult {
  if (input === null || input === undefined) {
    return { display: null, dedupKey: null, needsReview: false };
  }
  const raw = String(input).trim();
  if (!raw) return { display: null, dedupKey: null, needsReview: false };

  const r = canonicalizePhoneAR(raw);
  if (r.ok === true) {
    return { display: r.e164, dedupKey: r.e164, needsReview: false };
  }
  const reason = r.reason;
  if (reason === 'foreign' || reason === 'ambiguous_landline') {
    const digits = raw.replace(/\D+/g, '');
    return {
      display: raw,
      dedupKey: digits ? `raw:${digits}` : null,
      needsReview: true,
      reason,
    };
  }
  return { display: null, dedupKey: null, needsReview: false, reason };
}

/**
 * @deprecated Reservada por compatibilidad: devuelve solo la clave de dedup.
 * Internamente usa `processImportPhone`.
 */
export function normalizePhone(input: unknown): string | null {
  return processImportPhone(input).dedupKey;
}

export function normalizeEmail(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().toLowerCase();
  return raw || null;
}

export function normalizeText(input: unknown, max = 240): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  return raw.slice(0, max);
}

export function normalizeName(input: unknown): string | null {
  const t = normalizeText(input, 80);
  return t;
}

const TRUE_TOKENS = new Set([
  'si', 'sí', 's', 'true', 'verdadero', 'yes', 'y', '1', 'x',
]);
const FALSE_TOKENS = new Set([
  'no', 'n', 'false', 'falso', '0', '',
]);

export function normalizeBoolean(input: unknown, defaultValue = true): boolean {
  if (input === null || input === undefined) return defaultValue;
  if (typeof input === 'boolean') return input;
  if (typeof input === 'number') return input !== 0;
  const raw = String(input).trim().toLowerCase();
  if (TRUE_TOKENS.has(raw)) return true;
  if (FALSE_TOKENS.has(raw)) return false;
  return defaultValue;
}

// Excel serial date -> JS Date (1900 system)
function excelSerialToDate(serial: number): Date | null {
  if (!isFinite(serial) || serial <= 0) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  return new Date(utcMs);
}

function pad(n: number) { return n < 10 ? '0' + n : String(n); }

function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Parse a date from common formats. Returns YYYY-MM-DD or null.
 * Accepts: Date, Excel serial number, "DD/MM/YYYY", "DD-MM-YYYY",
 * "YYYY-MM-DD", "YYYY/MM/DD".
 */
export function normalizeDate(input: unknown): string | null {
  if (input === null || input === undefined || input === '') return null;

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return toIsoDate(new Date(Date.UTC(
      input.getFullYear(), input.getMonth(), input.getDate()
    )));
  }

  if (typeof input === 'number') {
    const d = excelSerialToDate(input);
    if (!d || isNaN(d.getTime())) return null;
    return toIsoDate(d);
  }

  const raw = String(input).trim();
  if (!raw) return null;

  // ISO YYYY-MM-DD or YYYY/MM/DD
  let m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    return validDate(y, mo, d);
  }

  // DD/MM/YYYY or DD-MM-YYYY (also DD.MM.YYYY)
  m = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (m) {
    const d = +m[1], mo = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return validDate(y, mo, d);
  }

  return null;
}

function validDate(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
