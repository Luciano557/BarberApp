export interface CountryDial {
  code: string;
  name: string;
  dial: string;
  placeholder: string;
}

export const COUNTRIES: CountryDial[] = [
  { code: "AR", name: "Argentina", dial: "+54", placeholder: "11 5555 5555" },
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

export function buildPhone(dial: string, local: string): string {
  const digits = local.replace(/\D/g, "");
  return `${dial}${digits}`;
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}
