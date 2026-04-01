import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const { turno_id, motivo } = body;

    if (!turno_id) {
      return new Response(JSON.stringify({ error: "Missing turno_id" }), {
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

    // Fetch turno
    const { data: turno, error: turnoError } = await supabase
      .from("turnos")
      .select("id, user_id, cliente_email, cliente_telefono, estado, fecha, hora_inicio, organization_id, sucursal_id")
      .eq("id", turno_id)
      .single();

    if (turnoError || !turno) {
      return new Response(JSON.stringify({ error: "Turno not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate ownership (secure fallback)
    const isOwner =
      turno.user_id === user.id ||
      (turno.user_id === null && (
        (user.email && turno.cliente_email === user.email) ||
        (user.phone && turno.cliente_telefono === user.phone)
      ));

    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Not authorized for this turno" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate estado
    if (!["pendiente", "confirmado"].includes(turno.estado)) {
      return new Response(JSON.stringify({ error: "Turno cannot be cancelled in current state" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get timezone and config
    const [orgRes, configRes] = await Promise.all([
      supabase.from("organizations").select("timezone").eq("id", turno.organization_id).single(),
      supabase.from("agenda_config").select("cancelacion_limite_hs").eq("organization_id", turno.organization_id).eq("sucursal_id", turno.sucursal_id).single(),
    ]);

    const timezone = orgRes.data?.timezone || "America/Argentina/Buenos_Aires";
    const limiteHs = configRes.data?.cancelacion_limite_hs ?? 2;

    // Check if turno is in the future and respects limit
    const nowInTz = new Date().toLocaleString("en-US", { timeZone: timezone });
    const nowDate = new Date(nowInTz);
    const turnoDateTime = new Date(`${turno.fecha}T${turno.hora_inicio}`);
    const hoursUntil = (turnoDateTime.getTime() - nowDate.getTime()) / (1000 * 60 * 60);

    if (hoursUntil <= 0) {
      return new Response(JSON.stringify({ error: "Cannot cancel a past turno" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (hoursUntil < limiteHs) {
      return new Response(JSON.stringify({
        error: "cancel_limit",
        message: `Solo podés cancelar con al menos ${limiteHs} horas de anticipación.`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancel
    const { error: updateError } = await supabase
      .from("turnos")
      .update({
        estado: "cancelado",
        cancelado_at: new Date().toISOString(),
        cancelado_motivo: motivo?.trim() || null,
      })
      .eq("id", turno_id);

    if (updateError) {
      console.error("cancel-turno update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to cancel" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cancel-turno error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
