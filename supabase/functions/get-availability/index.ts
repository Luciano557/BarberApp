import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  computeBarberSlots,
  getZonedDateStr,
  slotInstantMs,
  timeToMinutes,
} from "../_shared/availability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (barbero_id) {
      horariosQuery = horariosQuery.or(`barbero_id.eq.${barbero_id},barbero_id.is.null`);
    }

    const [configRes, servicioRes, horariosRes, bloqueosRes, turnosRes, barberosRes] = await Promise.all([
      supabase
        .from("agenda_config")
        .select("duracion_base_min, buffer_antes_min, buffer_despues_min, dias_anticipacion, anticipacion_minima_reserva_min")
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

    const config: any = configRes.data || {
      duracion_base_min: 30,
      buffer_antes_min: 0,
      buffer_despues_min: 0,
      dias_anticipacion: 30,
      anticipacion_minima_reserva_min: 30,
    };
    const antMin = Number(config.anticipacion_minima_reserva_min ?? 30);

    // Resolve sucursal timezone (fallback to org, then default)
    const sucTzRes = await supabase
      .from("sucursales")
      .select("timezone, organization_id")
      .eq("id", sucursal_id)
      .single();
    let tz: string = sucTzRes.data?.timezone || "";
    if (!tz) {
      const orgTzRes = await supabase
        .from("organizations")
        .select("timezone")
        .eq("id", organization_id)
        .single();
      tz = orgTzRes.data?.timezone || "America/Argentina/Buenos_Aires";
    }

    const nowMs = Date.now();
    const cutoffMs = nowMs + antMin * 60000;
    const todayInTz = getZonedDateStr(new Date(nowMs), tz);
    const isPast = fecha < todayInTz;

    const servicio = servicioRes.data;
    if (!servicio) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const duracion = servicio.duracion_min || config.duracion_base_min;
    const bufferBefore = 0;
    const bufferAfter = config.buffer_despues_min || 0;
    const allHorarios = horariosRes.data || [];
    const bloqueos = bloqueosRes.data || [];
    const turnos = turnosRes.data || [];
    const activeBarberos: string[] = (barberosRes.data || []).map((b: any) => b.id);

    if (activeBarberos.length === 0) {
      return new Response(JSON.stringify({ slots: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseHorarios = allHorarios.filter((h: any) => h.barbero_id === null);
    const overrideHorarios = allHorarios.filter((h: any) => h.barbero_id !== null);

    const turnoCountByBarbero: Record<string, number> = {};
    for (const t of turnos) {
      turnoCountByBarbero[t.barbero_id] = (turnoCountByBarbero[t.barbero_id] || 0) + 1;
    }

    type SlotWithBarberos = { hora_inicio: string; hora_fin: string; barberos: { id: string }[] };
    const allSlots: Map<string, SlotWithBarberos> = new Map();

    for (const bid of activeBarberos) {
      const bOverrides = overrideHorarios.filter((h: any) => h.barbero_id === bid);
      const resolvedHorarios = bOverrides.length > 0 ? bOverrides : baseHorarios;
      const bBloqueos = bloqueos.filter((b: any) => b.barbero_id === bid || b.barbero_id === null);
      const bTurnos = turnos.filter((t: any) => t.barbero_id === bid);

      const barberSlots = computeBarberSlots({
        horarios: resolvedHorarios,
        bloqueos: bBloqueos,
        turnos: bTurnos,
        duracion,
        duracion_base_min: config.duracion_base_min || duracion,
        bufferBefore,
        bufferAfter,
      });

      for (const slot of barberSlots) {
        const key = `${slot.hora_inicio}-${slot.hora_fin}`;
        if (allSlots.has(key)) {
          allSlots.get(key)!.barberos.push({ id: bid });
        } else {
          allSlots.set(key, { hora_inicio: slot.hora_inicio, hora_fin: slot.hora_fin, barberos: [{ id: bid }] });
        }
      }
    }

    const filtered = isPast
      ? []
      : Array.from(allSlots.values()).filter(
          (s) => slotInstantMs(fecha, s.hora_inicio, tz) >= cutoffMs
        );
    const slots = filtered.sort(
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
