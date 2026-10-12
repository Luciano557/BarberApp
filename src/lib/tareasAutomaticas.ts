import { supabase } from '@/integrations/supabase/client';

/**
 * Tareas automáticas — utilidades compartidas (la tabla técnica sigue llamándose `tareas_recurrentes`).
 * Todo lo temporal (cuándo toca la próxima, qué es "hoy") lo decide la base; acá solo hay textos y conteos.
 */

export type PausaMotivo = 'manual' | 'sucursal_inactiva' | 'barbero_inactivo' | 'barbero_sin_asignacion';

export interface PausaInfo {
  /** Texto corto para la tarjeta ("Sucursal inactiva"). */
  label: string;
  /** Explicación de qué hace falta para que vuelva a correr. */
  hint: string;
  /** `true` si la pausó el sistema (se reanuda sola cuando desaparece la causa). */
  automatica: boolean;
}

export function describePausa(motivo: string | null | undefined): PausaInfo {
  switch (motivo) {
    case 'sucursal_inactiva':
      return { label: 'Sucursal inactiva', hint: 'Se reanuda sola cuando la sucursal vuelva a estar activa.', automatica: true };
    case 'barbero_inactivo':
      return { label: 'Barbero inactivo', hint: 'Se reanuda sola si el barbero vuelve a estar activo.', automatica: true };
    case 'barbero_sin_asignacion':
      return { label: 'Barbero sin asignación en la sucursal', hint: 'Se reanuda sola si el barbero vuelve a tener una asignación vigente en esta sucursal.', automatica: true };
    default:
      return { label: 'Pausada manualmente', hint: 'La pausaste vos. Se reanuda cuando la actives.', automatica: false };
  }
}

export type PausaAvisoTipo = 'sucursal' | 'barbero' | 'asignacion';

/** Texto del aviso previo a una acción que pausará Tareas automáticas. `null` = no hay nada que avisar. */
export function textoAvisoPausa(tipo: PausaAvisoTipo, cantidad: number): string | null {
  if (cantidad <= 0) return null;
  const uno = cantidad === 1;
  const sujeto = uno ? '1 Tarea automática' : `${cantidad} Tareas automáticas`;
  const verbo = uno ? 'se pausará' : 'se pausarán';
  const reanuda = uno ? 'Se reanudará sola' : 'Se reanudarán solas';
  const asignada = uno ? 'asignada' : 'asignadas';
  switch (tipo) {
    case 'sucursal':
      return `${sujeto} de esta sucursal ${verbo}. ${reanuda} cuando la sucursal vuelva a estar activa.`;
    case 'barbero':
      return `${sujeto} ${asignada} a esta persona ${verbo}. ${reanuda} si la persona vuelve a estar activa.`;
    case 'asignacion':
      return `${sujeto} ${asignada} a esta persona en esta sucursal ${verbo}. ${reanuda} si la persona vuelve a tener una asignación vigente acá.`;
  }
}

/** Asignación de un barbero a una sucursal (fila de `barberos_sucursales`). */
export interface AsignacionBarbero {
  id: string;
  sucursal_id: string;
  tipo: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

/**
 * ¿Esta asignación sostiene la pertenencia a la sucursal en el día `hoyIso` (YYYY-MM-DD)?
 * Misma regla que usa la base (`_tareas_auto_motivo_pausa`): principal y recurrente cuentan mientras exista la fila;
 * una temporal solo entre su inicio (sin inicio = ya empezó) y su fin. `disponible` no participa.
 * Es una anticipación para el aviso: la que decide es la base.
 */
export function sostienePertenencia(a: Pick<AsignacionBarbero, 'tipo' | 'fecha_inicio' | 'fecha_fin'>, hoyIso: string): boolean {
  if (a.tipo === 'principal' || a.tipo === 'recurrente') return true;
  if (a.tipo === 'temporal') return (!a.fecha_inicio || a.fecha_inicio <= hoyIso) && !!a.fecha_fin && a.fecha_fin >= hoyIso;
  return false;
}

/** Borrar `quitarId` deja al barbero sin ninguna asignación vigente en esa sucursal. `delPar`: filas del mismo barbero + sucursal. */
export function pierdePertenenciaAlQuitar(delPar: AsignacionBarbero[], quitarId: string, hoyIso: string): boolean {
  const objetivo = delPar.find(a => a.id === quitarId);
  if (!objetivo || !sostienePertenencia(objetivo, hoyIso)) return false;
  return !delPar.some(a => a.id !== quitarId && sostienePertenencia(a, hoyIso));
}

/** Mover la principal fuera de `sucursalOrigenId` deja al barbero sin asignación vigente allí. `delBarbero`: todas sus filas. */
export function pierdePertenenciaAlMoverPrincipal(delBarbero: AsignacionBarbero[], sucursalOrigenId: string, hoyIso: string): boolean {
  const principal = delBarbero.find(a => a.tipo === 'principal' && a.sucursal_id === sucursalOrigenId);
  if (!principal) return false;
  return !delBarbero.some(a => a.id !== principal.id && a.sucursal_id === sucursalOrigenId && sostienePertenencia(a, hoyIso));
}

export const TEXTO_AVISO_PAUSA_SIN_DATO =
  'No pudimos verificar si hay Tareas automáticas vinculadas. Si las hay, se pausarán.';

interface FiltroAfectadas {
  organizationId: string;
  /** Tareas automáticas de esta sucursal. */
  sucursalId?: string;
  /** Tareas automáticas individuales asignadas a este barbero (`barberos.id`). */
  barberoId?: string;
}

/**
 * Cuenta las Tareas automáticas ACTIVAS que una desactivación va a pausar.
 * Siempre filtra por organización (y por sucursal / barbero cuando corresponde).
 * Devuelve `null` si no se pudo consultar, para que el aviso lo diga en vez de callar.
 */
export async function contarTareasAutomaticasActivas({ organizationId, sucursalId, barberoId }: FiltroAfectadas): Promise<number | null> {
  try {
    let query = supabase
      .from('tareas_recurrentes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('activo', true);
    if (sucursalId) query = query.eq('sucursal_id', sucursalId);
    if (barberoId) query = query.eq('assignment_scope', 'individual').eq('asignado_a', barberoId);
    const { count, error } = await query;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}
