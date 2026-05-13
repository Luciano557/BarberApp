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
    const { organization_id, sucursal_id, barbero_id, servicio_id, fecha, hora_inicio, cliente_nombre, cliente_telefono, user_id, cliente_email } = body;

    // Validate required fields
    if (!organization_id || !sucursal_id || !barbero_id || !servicio_id || !fecha || !hora_inicio) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cliente_nombre || typeof cliente_nombre !== "string" || cliente_nombre.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Invalid client name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get service duration
    const { data: servicio } = await supabase
      .from("servicios")
      .select("duracion_min, nombre")
      .eq("id", servicio_id)
      .single();

    if (!servicio) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get config for buffers
    const { data: config } = await supabase
      .from("agenda_config")
      .select("duracion_base_min, buffer_antes_min, buffer_despues_min")
      .eq("organization_id", organization_id)
      .eq("sucursal_id", sucursal_id)
      .single();

    const duracion = servicio.duracion_min || config?.duracion_base_min || 30;
    const hora_fin = minutesToTime(timeToMinutes(hora_inicio) + duracion);

    // Get timezone
    const { data: sucursal } = await supabase
      .from("sucursales")
      .select("timezone")
      .eq("id", sucursal_id)
      .single();

    const { data: org } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", organization_id)
      .single();

    const timezone = sucursal?.timezone || org?.timezone || "America/Argentina/Buenos_Aires";

    // Check for conflicts - existing turnos in that time range for that barbero
    const bufferBefore = config?.buffer_antes_min || 0;
    const bufferAfter = config?.buffer_despues_min || 0;
    const checkStart = minutesToTime(timeToMinutes(hora_inicio) - bufferBefore);
    const checkEnd = minutesToTime(timeToMinutes(hora_fin) + bufferAfter);

    const { data: conflicts } = await supabase
      .from("turnos")
      .select("id")
      .eq("barbero_id", barbero_id)
      .eq("fecha", fecha)
      .in("estado", ["pendiente", "confirmado", "en_curso"])
      .or(`and(hora_inicio.lt.${checkEnd},hora_fin.gt.${checkStart})`);

    if (conflicts && conflicts.length > 0) {
      return new Response(
        JSON.stringify({
          error: "slot_taken",
          message: "Este horario ya fue reservado. Por favor elegí otro.",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert turno
    const { data: turno, error: insertError } = await supabase
      .from("turnos")
      .insert({
        organization_id,
        sucursal_id,
        barbero_id,
        servicio_id,
        fecha,
        hora_inicio,
        hora_fin,
        cliente_nombre: cliente_nombre.trim(),
        cliente_telefono: cliente_telefono?.trim() || null,
        cliente_email: cliente_email?.trim() || null,
        user_id: user_id || null,
        estado: "pendiente",
        timezone,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      // Check if exclusion constraint violation
      if (insertError.code === "23P01") {
        return new Response(
          JSON.stringify({
            error: "slot_taken",
            message: "Este horario ya fue reservado. Por favor elegí otro.",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(JSON.stringify({ error: "Failed to create appointment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ turno }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("validate-turno error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
