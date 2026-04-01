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
    const { organization_id } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "Missing organization_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract JWT
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

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uid = user.id;
    const email = user.email || null;
    const phone = user.phone || null;

    // Get org timezone
    const { data: org } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", organization_id)
      .single();

    const timezone = org?.timezone || "America/Argentina/Buenos_Aires";

    // Build ownership filter — secure fallback
    // user_id match OR (user_id IS NULL AND email/phone match)
    let ownershipFilter = `user_id.eq.${uid}`;
    const nullFilters: string[] = [];
    if (email) nullFilters.push(`cliente_email.eq.${email}`);
    if (phone) nullFilters.push(`cliente_telefono.eq.${phone}`);

    let query = supabase
      .from("turnos")
      .select(`
        id, fecha, hora_inicio, hora_fin, estado, cliente_nombre,
        sucursal_id, barbero_id, servicio_id, organization_id,
        sucursales!inner(nombre),
        barberos!inner(nombre, apellido),
        servicios!inner(nombre, precio, duracion_min)
      `)
      .eq("organization_id", organization_id)
      .in("estado", ["pendiente", "confirmado"]);

    // Apply ownership filter using or()
    if (nullFilters.length > 0) {
      const nullFallback = `and(user_id.is.null,or(${nullFilters.join(",")}))`;
      query = query.or(`${ownershipFilter},${nullFallback}`);
    } else {
      query = query.eq("user_id", uid);
    }

    // Filter future turnos only (date-level, we'll refine with hora below)
    const today = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
    query = query.gte("fecha", today);
    query = query.order("fecha", { ascending: true }).order("hora_inicio", { ascending: true });

    const { data: turnos, error: queryError } = await query;

    if (queryError) {
      console.error("get-my-turnos query error:", queryError);
      return new Response(JSON.stringify({ error: "Query failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get agenda_config for cancellation/modification limits
    // We need configs per sucursal for the turnos found
    const sucursalIds = [...new Set((turnos || []).map((t: any) => t.sucursal_id))];
    let configs: any[] = [];
    if (sucursalIds.length > 0) {
      const { data: cfgData } = await supabase
        .from("agenda_config")
        .select("sucursal_id, cancelacion_limite_hs, modificacion_limite_hs")
        .eq("organization_id", organization_id)
        .in("sucursal_id", sucursalIds);
      configs = cfgData || [];
    }

    const configMap = new Map(configs.map((c: any) => [c.sucursal_id, c]));

    // Filter out past turnos (today but hora already passed) and enrich
    const nowInTz = new Date().toLocaleString("en-US", { timeZone: timezone });
    const nowDate = new Date(nowInTz);
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

    const enriched = (turnos || [])
      .filter((t: any) => {
        if (t.fecha > today) return true;
        // Same day — check hora_inicio
        const [h, m] = t.hora_inicio.split(":").map(Number);
        return h * 60 + m > nowMinutes;
      })
      .map((t: any) => {
        const cfg = configMap.get(t.sucursal_id) || { cancelacion_limite_hs: 2, modificacion_limite_hs: 2 };

        // Calculate hours until turno
        const turnoDateTime = new Date(`${t.fecha}T${t.hora_inicio}`);
        const turnoInTz = new Date(turnoDateTime.toLocaleString("en-US", { timeZone: timezone }));
        const hoursUntil = (turnoInTz.getTime() - nowDate.getTime()) / (1000 * 60 * 60);

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
          puede_cancelar: hoursUntil >= (cfg.cancelacion_limite_hs || 2),
          puede_reprogramar: hoursUntil >= (cfg.modificacion_limite_hs || 2),
          cancelacion_limite_hs: cfg.cancelacion_limite_hs || 2,
          modificacion_limite_hs: cfg.modificacion_limite_hs || 2,
        };
      });

    return new Response(JSON.stringify({ turnos: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-my-turnos error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
