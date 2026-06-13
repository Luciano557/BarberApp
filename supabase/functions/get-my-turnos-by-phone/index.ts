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
    const { organization_id, telefono } = body;

    if (!organization_id || !telefono) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = canonicalPhoneOrNull(telefono);
    if (!phone) {
      // Inválido / extranjero / ambiguo → devolvemos lista vacía sin filtrar info.
      return new Response(JSON.stringify({ turnos: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: org } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", organization_id)
      .single();

    const timezone = org?.timezone || "America/Argentina/Buenos_Aires";
    const today = new Date().toLocaleDateString("en-CA", { timeZone: timezone });

    const { data: turnos, error: queryError } = await supabase
      .from("turnos")
      .select(`
        id, fecha, hora_inicio, hora_fin, estado, cliente_nombre,
        sucursal_id, barbero_id, servicio_id, organization_id,
        sucursales!inner(nombre),
        barberos!inner(nombre, apellido),
        servicios!inner(nombre, precio, duracion_min)
      `)
      .eq("organization_id", organization_id)
      .eq("cliente_telefono", phone)
      .in("estado", ["pendiente", "confirmado"])
      .gte("fecha", today)
      .order("fecha", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (queryError) {
      console.error("get-my-turnos-by-phone error:", queryError);
      return new Response(JSON.stringify({ error: "Query failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sucursalIds = [...new Set((turnos || []).map((t: any) => t.sucursal_id))];
    let configs: any[] = [];
    if (sucursalIds.length > 0) {
      const { data: cfgData } = await supabase
        .from("agenda_config")
        .select("sucursal_id, cancelacion_limite_min, modificacion_limite_min")
        .eq("organization_id", organization_id)
        .in("sucursal_id", sucursalIds);
      configs = cfgData || [];
    }
    const configMap = new Map(configs.map((c: any) => [c.sucursal_id, c]));

    const nowInTz = new Date().toLocaleString("en-US", { timeZone: timezone });
    const nowDate = new Date(nowInTz);
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

    const enriched = (turnos || [])
      .filter((t: any) => {
        if (t.fecha > today) return true;
        const [h, m] = t.hora_inicio.split(":").map(Number);
        return h * 60 + m > nowMinutes;
      })
      .map((t: any) => {
        const cfg = configMap.get(t.sucursal_id) || { cancelacion_limite_min: 120, modificacion_limite_min: 120 };
        const cancelMin = cfg.cancelacion_limite_min ?? 120;
        const modMin = cfg.modificacion_limite_min ?? 120;
        const turnoDateTime = new Date(`${t.fecha}T${t.hora_inicio}`);
        const turnoInTz = new Date(turnoDateTime.toLocaleString("en-US", { timeZone: timezone }));
        const minutesUntil = (turnoInTz.getTime() - nowDate.getTime()) / 60000;

        return {
          id: t.id,
          fecha: t.fecha,
          hora_inicio: t.hora_inicio,
          hora_fin: t.hora_fin,
          estado: t.estado,
          cliente_nombre: t.cliente_nombre,
          sucursal_id: t.sucursal_id,
          sucursal_nombre: t.sucursales?.nombre,
          barbero_id: t.barbero_id,
          barbero_nombre: t.barberos ? `${t.barberos.nombre} ${t.barberos.apellido}` : null,
          servicio_id: t.servicio_id,
          servicio_nombre: t.servicios?.nombre,
          servicio_precio: t.servicios?.precio,
          servicio_duracion: t.servicios?.duracion_min,
          organization_id: t.organization_id,
          puede_cancelar: minutesUntil >= cancelMin,
          puede_reprogramar: minutesUntil >= modMin,
          cancelacion_limite_min: cancelMin,
          modificacion_limite_min: modMin,
        };
      });

    return new Response(JSON.stringify({ turnos: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-my-turnos-by-phone error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
