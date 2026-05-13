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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { turno_id, nueva_fecha, nueva_hora_inicio } = body;

    if (!turno_id || !nueva_fecha || !nueva_hora_inicio) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch turno with service duration
    const { data: turno, error: turnoError } = await supabase
      .from("turnos")
      .select("id, user_id, cliente_email, cliente_telefono, estado, fecha, hora_inicio, hora_fin, organization_id, sucursal_id, barbero_id, servicio_id")
      .eq("id", turno_id)
      .single();

    if (turnoError || !turno) {
      return new Response(JSON.stringify({ error: "Turno not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate ownership
    const isOwner =
      turno.user_id === user.id ||
      (turno.user_id === null && (
        (user.email && turno.cliente_email === user.email) ||
        (user.phone && turno.cliente_telefono === user.phone)
      ));

    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pendiente", "confirmado"].includes(turno.estado)) {
      return new Response(JSON.stringify({ error: "Turno cannot be rescheduled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get config, service, timezone
    const [configRes, servicioRes, orgRes, sucRes] = await Promise.all([
      supabase.from("agenda_config").select("modificacion_limite_hs, buffer_antes_min, buffer_despues_min, duracion_base_min, anticipacion_minima_reserva_min")
        .eq("organization_id", turno.organization_id).eq("sucursal_id", turno.sucursal_id).single(),
      supabase.from("servicios").select("duracion_min").eq("id", turno.servicio_id).single(),
      supabase.from("organizations").select("timezone").eq("id", turno.organization_id).single(),
      supabase.from("sucursales").select("timezone").eq("id", turno.sucursal_id).single(),
    ]);

    const timezone = sucRes.data?.timezone || orgRes.data?.timezone || "America/Argentina/Buenos_Aires";
    const limiteHs = configRes.data?.modificacion_limite_hs ?? 2;
    const duracion = servicioRes.data?.duracion_min || configRes.data?.duracion_base_min || 30;

    // Check limit against ORIGINAL turno
    const nowInTz = new Date().toLocaleString("en-US", { timeZone: timezone });
    const nowDate = new Date(nowInTz);
    const originalDateTime = new Date(`${turno.fecha}T${turno.hora_inicio}`);
    const hoursUntilOriginal = (originalDateTime.getTime() - nowDate.getTime()) / (1000 * 60 * 60);

    if (hoursUntilOriginal <= 0) {
      return new Response(JSON.stringify({ error: "Cannot reschedule a past turno" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (hoursUntilOriginal < limiteHs) {
      return new Response(JSON.stringify({
        error: "modify_limit",
        message: `Solo podés reprogramar con al menos ${limiteHs} horas de anticipación.`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also validate new slot is in the future
    const newDateTime = new Date(`${nueva_fecha}T${nueva_hora_inicio}`);
    const hoursUntilNew = (newDateTime.getTime() - nowDate.getTime()) / (1000 * 60 * 60);
    if (hoursUntilNew <= 0) {
      return new Response(JSON.stringify({ error: "New slot must be in the future" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate new hora_fin
    const nueva_hora_fin = minutesToTime(timeToMinutes(nueva_hora_inicio) + duracion);

    // Check conflicts for new slot (excluding current turno)
    const bufferBefore = configRes.data?.buffer_antes_min || 0;
    const bufferAfter = configRes.data?.buffer_despues_min || 0;
    const checkStart = minutesToTime(timeToMinutes(nueva_hora_inicio) - bufferBefore);
    const checkEnd = minutesToTime(timeToMinutes(nueva_hora_fin) + bufferAfter);

    const { data: conflicts } = await supabase
      .from("turnos")
      .select("id")
      .eq("barbero_id", turno.barbero_id)
      .eq("fecha", nueva_fecha)
      .neq("id", turno_id)
      .in("estado", ["pendiente", "confirmado", "en_curso"])
      .or(`and(hora_inicio.lt.${checkEnd},hora_fin.gt.${checkStart})`);

    if (conflicts && conflicts.length > 0) {
      return new Response(JSON.stringify({
        error: "slot_taken",
        message: "Este horario ya fue reservado. Por favor elegí otro.",
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update turno
    const { error: updateError } = await supabase
      .from("turnos")
      .update({
        fecha: nueva_fecha,
        hora_inicio: nueva_hora_inicio,
        hora_fin: nueva_hora_fin,
      })
      .eq("id", turno_id);

    if (updateError) {
      console.error("reschedule update error:", updateError);
      if (updateError.code === "23P01") {
        return new Response(JSON.stringify({
          error: "slot_taken",
          message: "Este horario ya fue reservado. Por favor elegí otro.",
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to reschedule" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, fecha: nueva_fecha, hora_inicio: nueva_hora_inicio, hora_fin: nueva_hora_fin }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reschedule-turno error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
