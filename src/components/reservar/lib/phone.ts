import { canonicalizePhoneAR } from "@/lib/phone";

export interface CountryDial {
  code: string;
  name: string;
  dial: string;
  placeholder: string;
}

export const COUNTRIES: CountryDial[] = [
  { code: "AR", name: "Argentina", dial: "+54", placeholder: "11 2516-2528" },
  { code: "UY", name: "Uruguay", dial: "+598", placeholder: "9 123 4567" },
  { code: "CL", name: "Chile", dial: "+56", placeholder: "9 1234 5678" },
  { code: "PY", name: "Paraguay", dial: "+595", placeholder: "961 123456" },
  { code: "BR", name: "Brasil", dial: "+55", placeholder: "11 91234 5678" },
  { code: "MX", name: "México", dial: "+52", placeholder: "55 1234 5678" },
  { code: "CO", name: "Colombia", dial: "+57", placeholder: "300 1234567" },
  { code: "PE", name: "Perú", dial: "+51", placeholder: "987 654 321" },
  { code: "ES", name: "España", dial: "+34", placeholder: "612 34 56 78" },
  { code: "US", name: "Estados Unidos", dial: "+1", placeholder: "555 123 4567" },
];

/**
 * Construye el teléfono final que se envía a edge functions.
 * - Para Argentina: canoniza a `+549XXXXXXXXXX`.
 *   Si no es convertible, devuelve null.
 * - Para otros países: por ahora concatena dial + dígitos sin canonicalización
 *   específica. Se canonizará cuando se sumen más países al motor central.
 */
export function buildPhone(dial: string, local: string): string | null {
  const digits = (local || "").replace(/\D/g, "");
  if (dial === "+54") {
    const r = canonicalizePhoneAR(digits);
    return r.ok ? r.e164 : null;
  }
  if (!digits) return null;
  return `${dial}${digits}`;
}

// Re-export de la utilidad central para componentes del portal.
export { canonicalizePhoneAR, isValidPhoneAR, phoneErrorMessage } from "@/lib/phone";
