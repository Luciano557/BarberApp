import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { canonicalPhoneOrNull } from "../_shared/phone.ts";

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
    const { turno_id, motivo, telefono } = body;

    if (!turno_id || !telefono) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = canonicalPhoneOrNull(telefono);
    if (!phone) {
      return new Response(JSON.stringify({ error: "Invalid phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: turno, error: turnoError } = await supabase
      .from("turnos")
      .select("id, cliente_telefono, estado, fecha, hora_inicio, organization_id, sucursal_id")
      .eq("id", turno_id)
      .single();

    if (turnoError || !turno) {
      return new Response(JSON.stringify({ error: "Turno not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (turno.cliente_telefono !== phone) {
      return new Response(JSON.stringify({ error: "Not authorized for this turno" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pendiente", "confirmado"].includes(turno.estado)) {
      return new Response(JSON.stringify({ error: "Turno cannot be cancelled in current state" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [orgRes, configRes] = await Promise.all([
      supabase.from("organizations").select("timezone").eq("id", turno.organization_id).single(),
      supabase.from("agenda_config").select("cancelacion_limite_hs").eq("organization_id", turno.organization_id).eq("sucursal_id", turno.sucursal_id).single(),
    ]);

    const timezone = orgRes.data?.timezone || "America/Argentina/Buenos_Aires";
    const limiteHs = configRes.data?.cancelacion_limite_hs ?? 2;

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
