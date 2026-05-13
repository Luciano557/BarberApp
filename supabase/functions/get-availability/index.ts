import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

interface Interval {
  start: number;
  end: number;
}

function getZonedDateStr(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function slotInstantMs(fecha: string, hora: string, tz: string): number {
  const [Y, M, D] = fecha.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const utcGuess = Date.UTC(Y, M - 1, D, h, m);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]));
  let hh = +parts.hour;
  if (hh === 24) hh = 0;
  const asTzMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, hh, +parts.minute);
  const offset = asTzMs - utcGuess;
  return utcGuess - offset;
}

function subtractIntervals(base: Interval[], blocks: Interval[]): Interval[] {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { organization_id, sucursal_id, servicio_id, fecha, barbero_id, exclude_turno_id } = body;

    if (!organization_id || !sucursal_id || !servicio_id || !fecha) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const dateObj = new Date(fecha + "T12:00:00Z");
    const jsDow = dateObj.getUTCDay();
    const dbDow = jsDow === 0 ? 7 : jsDow;

    // Build barberos query
    let barberosQuery = supabase
      .from("barberos")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("sucursal_id", sucursal_id)
      .eq("activo", true)
      .eq("rol_equipo", "barbero");
    if (barbero_id) barberosQuery = barberosQuery.eq("id", barbero_id);

    // Build horarios query — fetch ALL (base + overrides) for this day
    let horariosQuery = supabase
      .from("horarios_trabajo")
      .select("barbero_id, hora_inicio, hora_fin")
      .eq("organization_id", organization_id)
      .eq("sucursal_id", sucursal_id)
      .eq("dia_semana", dbDow)
      .eq("activo", true);
    // If specific barbero requested, fetch their overrides + base (null)
    if (barbero_id) {
      horariosQuery = horariosQuery.or(`barbero_id.eq.${barbero_id},barbero_id.is.null`);
    }

    const [configRes, servicioRes, horariosRes, bloqueosRes, turnosRes, barberosRes] = await Promise.all([
      supabase
        .from("agenda_config")
        .select("duracion_base_min, buffer_antes_min, buffer_despues_min, dias_anticipacion")
        .eq("organization_id", organization_id)
        .eq("sucursal_id", sucursal_id)
        .single(),
      supabase
        .from("servicios")
        .select("duracion_min")
        .eq("id", servicio_id)
        .single(),
      horariosQuery,
      supabase
        .from("bloqueos_agenda")
        .select("barbero_id, hora_inicio, hora_fin, todo_el_dia")
        .eq("organization_id", organization_id)
        .eq("sucursal_id", sucursal_id)
        .lte("fecha_inicio", fecha)
        .gte("fecha_fin", fecha),
      (() => {
        let q = supabase
          .from("turnos")
          .select("id, barbero_id, hora_inicio, hora_fin")
          .eq("organization_id", organization_id)
          .eq("sucursal_id", sucursal_id)
          .eq("fecha", fecha)
          .in("estado", ["pendiente", "confirmado", "en_curso"]);
        if (exclude_turno_id) q = q.neq("id", exclude_turno_id);
        return q;
      })(),
      barberosQuery,
    ]);

    const config = configRes.data || { duracion_base_min: 30, buffer_antes_min: 0, buffer_despues_min: 0, dias_anticipacion: 30 };
    const servicio = servicioRes.data;
    if (!servicio) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const duracion = servicio.duracion_min || config.duracion_base_min;
    const bufferBefore = 0; // buffer antes eliminado
    const bufferAfter = config.buffer_despues_min || 0;
    const totalSlotDuration = duracion + bufferAfter;
    const allHorarios = horariosRes.data || [];
    const bloqueos = bloqueosRes.data || [];
    const turnos = turnosRes.data || [];
    const activeBarberos: string[] = (barberosRes.data || []).map((b: any) => b.id);

    if (activeBarberos.length === 0) {
      return new Response(JSON.stringify({ slots: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Separate base (barbero_id=null) vs override horarios
    const baseHorarios = allHorarios.filter((h: any) => h.barbero_id === null);
    const overrideHorarios = allHorarios.filter((h: any) => h.barbero_id !== null);

    // Count existing turnos per barbero for load balancing
    const turnoCountByBarbero: Record<string, number> = {};
    for (const t of turnos) {
      turnoCountByBarbero[t.barbero_id] = (turnoCountByBarbero[t.barbero_id] || 0) + 1;
    }

    type SlotWithBarberos = { hora_inicio: string; hora_fin: string; barberos: { id: string }[] };
    const allSlots: Map<string, SlotWithBarberos> = new Map();

    for (const bid of activeBarberos) {
      // Resolve hierarchy: override wins, fallback to base
      const bOverrides = overrideHorarios.filter((h: any) => h.barbero_id === bid);
      const resolvedHorarios = bOverrides.length > 0 ? bOverrides : baseHorarios;

      let intervals: Interval[] = resolvedHorarios.map((h: any) => ({
        start: timeToMinutes(h.hora_inicio),
        end: timeToMinutes(h.hora_fin),
      }));

      if (intervals.length === 0) continue;

      // Subtract bloqueos
      const bBloqueos = bloqueos.filter((b: any) => b.barbero_id === bid || b.barbero_id === null);
      const blockIntervals: Interval[] = bBloqueos.map((b: any) => {
        if (b.todo_el_dia) return { start: 0, end: 1440 };
        return { start: timeToMinutes(b.hora_inicio), end: timeToMinutes(b.hora_fin) };
      });
      intervals = subtractIntervals(intervals, blockIntervals);

      // Subtract existing turnos with buffers
      const bTurnos = turnos.filter((t: any) => t.barbero_id === bid);
      const turnoIntervals: Interval[] = bTurnos.map((t: any) => ({
        start: timeToMinutes(t.hora_inicio) - bufferBefore,
        end: timeToMinutes(t.hora_fin) + bufferAfter,
      }));
      intervals = subtractIntervals(intervals, turnoIntervals);

      // Generate slots
      for (const iv of intervals) {
        let cursor = iv.start;
        while (cursor + totalSlotDuration <= iv.end) {
          const slotStart = minutesToTime(cursor + bufferBefore);
          const slotEnd = minutesToTime(cursor + bufferBefore + duracion);
          const key = `${slotStart}-${slotEnd}`;
          if (allSlots.has(key)) {
            allSlots.get(key)!.barberos.push({ id: bid });
          } else {
            allSlots.set(key, { hora_inicio: slotStart, hora_fin: slotEnd, barberos: [{ id: bid }] });
          }
          cursor += config.duracion_base_min || duracion;
        }
      }
    }

    const slots = Array.from(allSlots.values()).sort(
      (a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)
    );

    for (const slot of slots) {
      slot.barberos.sort(
        (a, b) => (turnoCountByBarbero[a.id] || 0) - (turnoCountByBarbero[b.id] || 0)
      );
    }

    return new Response(JSON.stringify({ slots }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-availability error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
