import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  computeBarberSlots,
  getZonedDateStr,
  slotInstantMs,
} from "../_shared/availability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function dateToStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { organization_id, sucursal_id, servicio_id, barbero_id, from_date, to_date } = body;

    if (!organization_id || !sucursal_id || !servicio_id || !from_date || !to_date) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Disponibilidad por sucursal (Fase 3) — corre en paralelo
    let bsQuery = supabase
      .from("barberos_sucursales")
      .select("barbero_id")
      .eq("organization_id", organization_id)
      .eq("sucursal_id", sucursal_id)
      .eq("disponible", true);
    if (barbero_id) bsQuery = bsQuery.eq("barbero_id", barbero_id);

    // Horarios sin filtrar por dia_semana (necesitamos todos los días de la semana)
    let horariosQuery = supabase
      .from("horarios_trabajo")
      .select("barbero_id, dia_semana, hora_inicio, hora_fin")
      .eq("organization_id", organization_id)
      .eq("sucursal_id", sucursal_id)
      .eq("activo", true);
    if (barbero_id) {
      horariosQuery = horariosQuery.or(`barbero_id.eq.${barbero_id},barbero_id.is.null`);
    }

    const [configRes, servicioRes, horariosRes, bloqueosRes, turnosRes, bsRes, sucTzRes] =
      await Promise.all([
        supabase
          .from("agenda_config")
          .select(
            "duracion_base_min, buffer_antes_min, buffer_despues_min, dias_anticipacion, anticipacion_minima_reserva_min"
          )
          .eq("organization_id", organization_id)
          .eq("sucursal_id", sucursal_id)
          .single(),
        // Security: filter servicios by organization_id to prevent cross-org data access
        supabase
          .from("servicios")
          .select("duracion_min")
          .eq("id", servicio_id)
          .eq("organization_id", organization_id)
          .single(),
        horariosQuery,
        supabase
          .from("bloqueos_agenda")
          .select("barbero_id, fecha_inicio, fecha_fin, hora_inicio, hora_fin, todo_el_dia")
          .eq("organization_id", organization_id)
          .eq("sucursal_id", sucursal_id)
          .lte("fecha_inicio", to_date)
          .gte("fecha_fin", from_date),
        supabase
          .from("turnos")
          .select("barbero_id, fecha, hora_inicio, hora_fin")
          .eq("organization_id", organization_id)
          .eq("sucursal_id", sucursal_id)
          .gte("fecha", from_date)
          .lte("fecha", to_date)
          .in("estado", ["pendiente", "confirmado", "en_curso"]),
        bsQuery,
        supabase
          .from("sucursales")
          .select("timezone, organization_id")
          .eq("id", sucursal_id)
          .single(),
      ]);

    const config: any = configRes.data || {
      duracion_base_min: 30,
      buffer_antes_min: 0,
      buffer_despues_min: 0,
      dias_anticipacion: 30,
      anticipacion_minima_reserva_min: 30,
    };

    // Resolve timezone
    let tz: string = sucTzRes.data?.timezone || "";
    if (!tz) {
      const orgTzRes = await supabase
        .from("organizations")
        .select("timezone")
        .eq("id", organization_id)
        .single();
      tz = orgTzRes.data?.timezone || "America/Argentina/Buenos_Aires";
    }

    const servicio = servicioRes.data;
    if (!servicio) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const disponibleIds: string[] = (bsRes.data || []).map((r: any) => r.barbero_id);
    if (disponibleIds.length === 0) {
      return new Response(
        JSON.stringify({ available_dates: [], max_date: from_date }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: barberosData } = await supabase
      .from("barberos")
      .select("id")
      .eq("organization_id", organization_id)
      .in("id", disponibleIds)
      .eq("activo", true)
      .contains("roles_equipo", ["barber"]);

    const activeBarberos: string[] = (barberosData || []).map((b: any) => b.id);
    if (activeBarberos.length === 0) {
      return new Response(
        JSON.stringify({ available_dates: [], max_date: from_date }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const duracion = servicio.duracion_min || config.duracion_base_min;
    const bufferBefore = 0;
    const bufferAfter = config.buffer_despues_min || 0;
    const diasAnticipacion = config.dias_anticipacion || 30;
    const antMin = Number(config.anticipacion_minima_reserva_min ?? 30);

    const allHorarios = horariosRes.data || [];
    const allBloqueos = bloqueosRes.data || [];
    const allTurnos = turnosRes.data || [];

    // Calculate max allowed date from agenda_config
    const nowMs = Date.now();
    const cutoffMs = nowMs + antMin * 60000;
    const todayInTz = getZonedDateStr(new Date(nowMs), tz);
    const maxAllowedMs = nowMs + diasAnticipacion * 24 * 60 * 60 * 1000;
    const maxDateStr = getZonedDateStr(new Date(maxAllowedMs), tz);

    // Clamp to_date to maxAllowedDate
    const effectiveToDate = to_date > maxDateStr ? maxDateStr : to_date;

    // Separate base vs override horarios once (not per day)
    const baseHorarios = allHorarios.filter((h: any) => h.barbero_id === null);
    const overrideHorarios = allHorarios.filter((h: any) => h.barbero_id !== null);

    // ── Iterar por cada día del rango ────────────────────────────────────────
    const available_dates: string[] = [];

    // Build date iteration (UTC noon to keep day stable across timezones)
    const current = new Date(from_date + "T12:00:00Z");
    const limitDate = new Date(effectiveToDate + "T12:00:00Z");

    while (current <= limitDate) {
      const dateStr = dateToStr(current);
      const jsDow = current.getUTCDay();
      const dbDow = jsDow === 0 ? 7 : jsDow;

      // Skip past dates (compared in sucursal timezone)
      if (dateStr < todayInTz) {
        current.setUTCDate(current.getUTCDate() + 1);
        continue;
      }

      // Filter pre-loaded data for this specific day
      const dayHorarios = allHorarios.filter((h: any) => h.dia_semana === dbDow);
      const dayBloqueos = allBloqueos.filter(
        (b: any) => b.fecha_inicio <= dateStr && b.fecha_fin >= dateStr
      );
      const dayTurnos = allTurnos.filter((t: any) => t.fecha === dateStr);

      const dayBaseHorarios = baseHorarios.filter((h: any) => h.dia_semana === dbDow);
      const dayOverrideHorarios = overrideHorarios.filter((h: any) => h.dia_semana === dbDow);

      // Check if any barbero has at least 1 valid slot on this day
      let dayHasSlots = false;

      for (const bid of activeBarberos) {
        if (dayHasSlots) break; // short-circuit once found

        const bOverrides = dayOverrideHorarios.filter((h: any) => h.barbero_id === bid);
        const resolvedHorarios = bOverrides.length > 0 ? bOverrides : dayBaseHorarios;
        const bBloqueos = dayBloqueos.filter(
          (b: any) => b.barbero_id === bid || b.barbero_id === null
        );
        const bTurnos = dayTurnos.filter((t: any) => t.barbero_id === bid);

        const slots = computeBarberSlots({
          horarios: resolvedHorarios,
          bloqueos: bBloqueos,
          turnos: bTurnos,
          duracion,
          duracion_base_min: config.duracion_base_min || duracion,
          bufferBefore,
          bufferAfter,
        });

        // Apply anticipacion minima filter (same as get-availability)
        const validSlots = slots.filter(
          (s) => slotInstantMs(dateStr, s.hora_inicio, tz) >= cutoffMs
        );

        if (validSlots.length > 0) dayHasSlots = true;
      }

      if (dayHasSlots) available_dates.push(dateStr);

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return new Response(
      JSON.stringify({ available_dates, max_date: maxDateStr }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("get-available-dates error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
