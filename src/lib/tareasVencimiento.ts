import { parseISO, startOfDay, addDays, differenceInCalendarDays } from 'date-fns';

export interface TareaVencInput {
  tipo: string;
  estado: string;
  fecha_inicio: string | null;
  fecha_limite?: string | null;
  created_at: string;
  vencimiento_dias?: number | null;
}

/**
 * Calcula vencimiento visual de una tarea interna.
 * Vencida = hoy > fecha_inicio + diasDefault
 */
export function getTareaVencimiento(t: TareaVencInput, diasDefault: number) {
  if (t.tipo !== 'tarea' || t.estado === 'completada' || !t.fecha_inicio) {
    return { vencida: false, diasRestantes: null as number | null };
  }
  const inicio = startOfDay(parseISO(t.fecha_inicio));
  const limite = addDays(inicio, Math.max(0, diasDefault));
  const hoy = startOfDay(new Date());
  const diasRestantes = differenceInCalendarDays(limite, hoy);
  return { vencida: diasRestantes < 0, diasRestantes };
}

/**
 * Calcula vencimiento visual de una petición (relativo a created_at).
 */
export function getPeticionVencimiento(t: TareaVencInput, diasOrgDefault: number) {
  const dias = t.vencimiento_dias ?? diasOrgDefault ?? 60;
  const creado = startOfDay(parseISO(t.created_at));
  const limite = addDays(creado, dias);
  const hoy = startOfDay(new Date());
  const diasRestantes = differenceInCalendarDays(limite, hoy);
  return { vencida: diasRestantes < 0, diasRestantes };
}
