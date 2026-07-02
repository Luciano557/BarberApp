export interface Interval {
  start: number;
  end: number;
}

export interface SlotEntry {
  hora_inicio: string;
  hora_fin: string;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function getZonedDateStr(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function slotInstantMs(fecha: string, hora: string, tz: string): number {
  const [Y, M, D] = fecha.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const utcGuess = Date.UTC(Y, M - 1, D, h, m);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]));
  let hh = +parts.hour;
  if (hh === 24) hh = 0;
  const asTzMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, hh, +parts.minute);
  const offset = asTzMs - utcGuess;
  return utcGuess - offset;
}

export function subtractIntervals(base: Interval[], blocks: Interval[]): Interval[] {
  let result = [...base];
  for (const block of blocks) {
    const next: Interval[] = [];
    for (const r of result) {
      if (block.end <= r.start || block.start >= r.end) {
        next.push(r);
      } else {
        if (block.start > r.start) next.push({ start: r.start, end: block.start });
        if (block.end < r.end) next.push({ start: block.end, end: r.end });
      }
    }
    result = next;
  }
  return result;
}

/**
 * Computes available slots for a single barbero on a single day.
 * Inputs must already be pre-filtered for the specific barbero and date.
 */
export function computeBarberSlots(params: {
  horarios: { hora_inicio: string; hora_fin: string }[];
  bloqueos: { hora_inicio: string | null; hora_fin: string | null; todo_el_dia: boolean }[];
  turnos: { hora_inicio: string; hora_fin: string }[];
  duracion: number;
  duracion_base_min: number;
  bufferBefore: number;
  bufferAfter: number;
}): SlotEntry[] {
  const totalSlotDuration = params.duracion + params.bufferAfter;

  let intervals: Interval[] = params.horarios.map((h) => ({
    start: timeToMinutes(h.hora_inicio),
    end: timeToMinutes(h.hora_fin),
  }));

  if (intervals.length === 0) return [];

  const blockIntervals: Interval[] = params.bloqueos.map((b) =>
    b.todo_el_dia
      ? { start: 0, end: 1440 }
      : { start: timeToMinutes(b.hora_inicio!), end: timeToMinutes(b.hora_fin!) }
  );
  intervals = subtractIntervals(intervals, blockIntervals);

  const turnoIntervals: Interval[] = params.turnos.map((t) => ({
    start: timeToMinutes(t.hora_inicio) - params.bufferBefore,
    end: timeToMinutes(t.hora_fin) + params.bufferAfter,
  }));
  intervals = subtractIntervals(intervals, turnoIntervals);

  const slots: SlotEntry[] = [];
  for (const iv of intervals) {
    let cursor = iv.start;
    while (cursor + totalSlotDuration <= iv.end) {
      slots.push({
        hora_inicio: minutesToTime(cursor + params.bufferBefore),
        hora_fin: minutesToTime(cursor + params.bufferBefore + params.duracion),
      });
      cursor += params.duracion_base_min || params.duracion;
    }
  }
  return slots;
}

// ============================================================================
// Shared feasibility helpers used by public (reschedule-turno / validate-turno)
// and internal (update-turno-internal) flows.
// ============================================================================

export function getDbDow(fecha: string): number {
  const [Y, M, D] = fecha.split("-").map(Number);
  const jsDow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
  return jsDow === 0 ? 7 : jsDow;
}

/**
 * Returns true when [slotStartMin, slotEndMin) fits inside the barbero's
 * working hours for that day. Barbero override overrides sucursal default.
 */
export async function isWithinWorkingHours(
  supabase: any,
  params: {
    orgId: string;
    sucursalId: string;
    barberoId: string;
    fecha: string;
    slotStartMin: number;
    slotEndMin: number;
  },
): Promise<boolean> {
  const dbDow = getDbDow(params.fecha);
  const { data } = await supabase
    .from("horarios_trabajo")
    .select("barbero_id, hora_inicio, hora_fin")
    .eq("organization_id", params.orgId)
    .eq("sucursal_id", params.sucursalId)
    .eq("dia_semana", dbDow)
    .eq("activo", true)
    .or(`barbero_id.eq.${params.barberoId},barbero_id.is.null`);

  const all = data || [];
  const override = all.filter((h: any) => h.barbero_id === params.barberoId);
  const resolved = override.length > 0
    ? override
    : all.filter((h: any) => h.barbero_id === null);

  return resolved.some((h: any) =>
    timeToMinutes(h.hora_inicio) <= params.slotStartMin &&
    timeToMinutes(h.hora_fin) >= params.slotEndMin
  );
}

/**
 * Returns true when the slot overlaps a bloqueo (barbero-specific or sucursal-wide).
 */
export async function isBlockedByBloqueo(
  supabase: any,
  params: {
    orgId: string;
    sucursalId: string;
    barberoId: string;
    fecha: string;
    slotStartMin: number;
    slotEndMin: number;
  },
): Promise<boolean> {
  const { data } = await supabase
    .from("bloqueos_agenda")
    .select("barbero_id, hora_inicio, hora_fin, todo_el_dia")
    .eq("organization_id", params.orgId)
    .eq("sucursal_id", params.sucursalId)
    .lte("fecha_inicio", params.fecha)
    .gte("fecha_fin", params.fecha);

  const relevant = (data || []).filter(
    (b: any) => b.barbero_id === params.barberoId || b.barbero_id === null,
  );
  return relevant.some((b: any) => {
    if (b.todo_el_dia) return true;
    if (!b.hora_inicio || !b.hora_fin) return false;
    const bStart = timeToMinutes(b.hora_inicio);
    const bEnd = timeToMinutes(b.hora_fin);
    return bStart < params.slotEndMin && bEnd > params.slotStartMin;
  });
}

export interface ConflictingTurno {
  id: string;
  hora_inicio: string;
  hora_fin: string;
  cliente_nombre: string | null;
}

/**
 * Returns turnos on the same barbero+fecha whose interval (including buffers)
 * overlaps the target slot. Excludes cancelled/completed. Note: no filter on
 * overlap_autorizado — public flows must still surface conflicts against
 * internally-authorized overlaps.
 */
export async function findConflictingTurnos(
  supabase: any,
  params: {
    barberoId: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    bufferBefore: number;
    bufferAfter: number;
    excludeTurnoId?: string;
  },
): Promise<ConflictingTurno[]> {
  const checkStart = minutesToTime(timeToMinutes(params.hora_inicio) - params.bufferBefore);
  const checkEnd = minutesToTime(timeToMinutes(params.hora_fin) + params.bufferAfter);

  let q = supabase
    .from("turnos")
    .select("id, hora_inicio, hora_fin, cliente_nombre")
    .eq("barbero_id", params.barberoId)
    .eq("fecha", params.fecha)
    .in("estado", ["pendiente", "confirmado", "en_curso"])
    .lt("hora_inicio", checkEnd)
    .gt("hora_fin", checkStart);

  if (params.excludeTurnoId) q = q.neq("id", params.excludeTurnoId);

  const { data } = await q;
  return (data || []) as ConflictingTurno[];
}

