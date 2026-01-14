/**
 * Utilidades de manejo de fechas con soporte de zona horaria
 * Permite consistencia en operaciones de fecha independientemente del dispositivo
 */

// Mapa de países a zonas horarias
export const COUNTRY_TIMEZONES: Record<string, string> = {
  AR: 'America/Argentina/Buenos_Aires',
  MX: 'America/Mexico_City',
  CO: 'America/Bogota',
  CL: 'America/Santiago',
  PE: 'America/Lima',
  EC: 'America/Guayaquil',
  UY: 'America/Montevideo',
  PY: 'America/Asuncion',
  BO: 'America/La_Paz',
  VE: 'America/Caracas',
  ES: 'Europe/Madrid',
  BR: 'America/Sao_Paulo',
  CR: 'America/Costa_Rica',
  PA: 'America/Panama',
  DO: 'America/Santo_Domingo',
  GT: 'America/Guatemala',
  HN: 'America/Tegucigalpa',
  SV: 'America/El_Salvador',
  NI: 'America/Managua',
  PR: 'America/Puerto_Rico',
  CU: 'America/Havana',
};

// Lista de países para el selector
export const COUNTRIES = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  { code: 'PA', name: 'Panamá', flag: '🇵🇦' },
  { code: 'DO', name: 'República Dominicana', flag: '🇩🇴' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
];

/**
 * Obtiene el inicio del día en formato string para queries de Supabase
 * Mantiene la fecha local del usuario sin conversión UTC
 */
export function getStartOfDayLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00`;
}

/**
 * Obtiene el fin del día en formato string para queries de Supabase
 * Mantiene la fecha local del usuario sin conversión UTC
 */
export function getEndOfDayLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T23:59:59`;
}

/**
 * Formatea una fecha para display en formato YYYY-MM-DD
 */
export function formatDateForQuery(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
