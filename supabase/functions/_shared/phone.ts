/**
 * Vittro — Utilidad central de teléfonos (edge functions).
 * Misma lógica que `src/lib/phone.ts` para evitar divergencias.
 * Formato canónico móvil argentino: +549XXXXXXXXXX.
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

  if (L === 13 && d.startsWith("549") && "123".includes(d[3])) {
    return { ok: true, e164: "+" + d };
  }
  if (L === 12 && d.startsWith("54") && "123".includes(d[2])) {
    return { ok: true, e164: "+549" + d.slice(2) };
  }
  if (L === 13 && d.startsWith("011") && d.slice(3, 5) === "15") {
    return { ok: true, e164: "+549" + d.slice(1, 3) + d.slice(5) };
  }
  if (L === 11 && d[0] === "0" && "123".includes(d[1])) {
    return { ok: false, reason: "ambiguous_landline" };
  }
  if (L === 10 && "123".includes(d[0])) {
    return { ok: true, e164: "+549" + d };
  }
  return { ok: false, reason: "invalid" };
}

export function isValidPhoneAR(input: unknown): boolean {
  return canonicalizePhoneAR(input).ok;
}

/**
 * Compatibilidad: helper que devuelve el e164 canónico o `null`.
 * Útil para reemplazar las viejas `normalizePhone` locales.
 */
export function canonicalPhoneOrNull(input: unknown): string | null {
  const r = canonicalizePhoneAR(input);
  return r.ok ? r.e164 : null;
}
