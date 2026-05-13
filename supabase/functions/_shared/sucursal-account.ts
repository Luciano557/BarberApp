// Shared helpers for Cuenta de sucursal edge functions

export function generateTempPassword(): string {
  // 12 chars, alphanumeric, no ambiguous (0/O/1/l/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

export function slugify(input: string): string {
  return (input || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "sucursal";
}

export function buildAccountEmail(sucursalNombre: string, sucursalId: string): string {
  const slug = slugify(sucursalNombre);
  const short = sucursalId.replace(/-/g, "").slice(0, 8);
  return `sucursal-${slug}-${short}@vittro-accounts.app`;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
