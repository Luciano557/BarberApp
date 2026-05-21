/**
 * Vittro — Utilidad central de teléfonos (edge functions).
 * Misma lógica que `src/lib/phone.ts` para evitar divergencias.
 *
 * Formato canónico AR: +54XXXXXXXXXX (12 dígitos tras el '+'), sin el `9` intermedio.
 * Alineado con la DB tras la migración 2026-05.
 *
 * Reglas:
 *  - `+549XXXXXXXXXX` (13d)        → `+54XXXXXXXXXX` (strip del 9)
 *  - `+54XXXXXXXXXX`  (12d)        → idem (idempotente)
 *  - `011 15 + 8`     (13d)        → `+54 + area(2) + 8`
 *  - `0 + area + 8`   (11d)        → `+54 + 10`
 *  - `area + 8`       (10d)        → `+54 + 10`
 *  - Comienza con `+` y no es `+54…` → foreign
 *  - Resto                           → invalid
 */

export type CanonicalizeReason =
  | "empty"
  | "invalid"
  | "foreign"
  | "ambiguous_landline";

export type CanonicalizeResult =
  | { ok: true; e164: string }
  | { ok: false; reason: CanonicalizeReason };

const onlyDigits = (s: string): string => s.replace(/\D+/g, "");

export function canonicalizePhoneAR(input: unknown): CanonicalizeResult {
  if (input === null || input === undefined) return { ok: false, reason: "empty" };
  const raw = String(input).trim();
  if (!raw) return { ok: false, reason: "empty" };

  if (raw.startsWith("+") && !raw.replace(/\s+/g, "").startsWith("+54")) {
    return { ok: false, reason: "foreign" };
  }

  const d = onlyDigits(raw);
  const L = d.length;
  if (L === 0) return { ok: false, reason: "invalid" };

  // 13d: 549 + 10 → strip del 9 → +54 + 10
  if (L === 13 && d.startsWith("549") && "123".includes(d[3])) {
    return { ok: true, e164: "+54" + d.slice(3) };
  }
  // 12d: 54 + 10 (formato canónico actual) — idempotente
  if (L === 12 && d.startsWith("54") && "123".includes(d[2])) {
    return { ok: true, e164: "+" + d };
  }
  // 13d: 011 15 + 8 → +54 + area(2) + 8
  if (L === 13 && d.startsWith("011") && d.slice(3, 5) === "15") {
    return { ok: true, e164: "+54" + d.slice(1, 3) + d.slice(5) };
  }
  // 11d: 0 + area + 8 → +54 + 10
  if (L === 11 && d[0] === "0" && "123".includes(d[1])) {
    return { ok: true, e164: "+54" + d.slice(1) };
  }
  // 10d nacional: area + 8 → +54 + 10
  if (L === 10 && "123".includes(d[0])) {
    return { ok: true, e164: "+54" + d };
  }
  return { ok: false, reason: "invalid" };
}

export function isValidPhoneAR(input: unknown): boolean {
  return canonicalizePhoneAR(input).ok;
}

/**
 * Compatibilidad: helper que devuelve el e164 canónico o `null`.
 */
export function canonicalPhoneOrNull(input: unknown): string | null {
  const r = canonicalizePhoneAR(input);
  return r.ok ? r.e164 : null;
}
