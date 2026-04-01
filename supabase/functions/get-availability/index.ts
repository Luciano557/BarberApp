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

    // Parse date to get day of week (0=Sunday in JS, but DB uses 0=Monday style)
    const dateObj = new Date(fecha + "T12:00:00Z");
    const jsDow = dateObj.getUTCDay(); // 0=Sun
    const dbDow = jsDow === 0 ? 7 : jsDow; // 1=Mon..7=Sun

    // Parallel fetches
    const [configRes, servicioRes, horariosRes, bloqueosRes, turnosRes] = await Promise.all([
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
      supabase
        .from("horarios_trabajo")
        .select("barbero_id, hora_inicio, hora_fin")
        .eq("organization_id", organization_id)
        .eq("sucursal_id", sucursal_id)
        .eq("dia_semana", dbDow)
        .eq("activo", true)
        .then((res) => {
          // Filter by barbero if specified
          if (barbero_id && res.data) {
            return { ...res, data: res.data.filter((h: any) => h.barbero_id === barbero_id) };
          }
          return res;
        }),
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
    const bufferBefore = config.buffer_antes_min || 0;
    const bufferAfter = config.buffer_despues_min || 0;
    const totalSlotDuration = bufferBefore + duracion + bufferAfter;
    const horarios = horariosRes.data || [];
    const bloqueos = bloqueosRes.data || [];
    const turnos = turnosRes.data || [];

    // Count existing turnos per barbero for load balancing
    const turnoCountByBarbero: Record<string, number> = {};
    for (const t of turnos) {
      turnoCountByBarbero[t.barbero_id] = (turnoCountByBarbero[t.barbero_id] || 0) + 1;
    }

    // Group by barbero
    const barberoIds = [...new Set(horarios.map((h: any) => h.barbero_id))];

    // For each barbero, compute available intervals
    type SlotWithBarberos = { hora_inicio: string; hora_fin: string; barberos: { id: string; nombre?: string }[] };
    const allSlots: Map<string, SlotWithBarberos> = new Map();

    for (const bid of barberoIds) {
      const bHorarios = horarios.filter((h: any) => h.barbero_id === bid);
      let intervals: Interval[] = bHorarios.map((h: any) => ({
        start: timeToMinutes(h.hora_inicio),
        end: timeToMinutes(h.hora_fin),
      }));

      // Subtract bloqueos for this barbero + sucursal-wide blocks
      const bBloqueos = bloqueos.filter(
        (b: any) => b.barbero_id === bid || b.barbero_id === null
      );
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
            allSlots.get(key)!.barberos.push({ id: bid as string });
          } else {
            allSlots.set(key, {
              hora_inicio: slotStart,
              hora_fin: slotEnd,
              barberos: [{ id: bid as string }],
            });
          }
          cursor += config.duracion_base_min || duracion;
        }
      }
    }

    // Sort slots by time, sort barberos by load (ascending)
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
