/**
 * Tipos y constantes compartidas de horarios de trabajo.
 * Los consumen el editor, el hook de fetch y el resumen de solo lectura.
 */

export interface HorarioRow {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
  barbero_id: string | null;
}

export const DIAS = [
  { num: 1, short: 'L', label: 'Lun', full: 'Lunes' },
  { num: 2, short: 'M', label: 'Mar', full: 'Martes' },
  { num: 3, short: 'M', label: 'Mié', full: 'Miércoles' },
  { num: 4, short: 'J', label: 'Jue', full: 'Jueves' },
  { num: 5, short: 'V', label: 'Vie', full: 'Viernes' },
  { num: 6, short: 'S', label: 'Sáb', full: 'Sábado' },
  { num: 7, short: 'D', label: 'Dom', full: 'Domingo' },
];

/** Recorta "09:00:00" a "09:00" (24 h, sin segundos). */
export const fmt = (t: string) => t.slice(0, 5);
