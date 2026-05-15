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
    const {
      organization_id,
      sucursal_id,
      barbero_id,
      servicio_id,
      fecha,
      hora_inicio,
      cliente_nombre,
      cliente_telefono,
      cliente_email: bodyClienteEmail,
      cliente_nombre_simple,
      cliente_apellido,
      cliente_fecha_nacimiento,
      cliente_instagram,
    } = body;

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

    // ===== Verify authenticated user (source of truth for user_id / email) =====
    let verifiedUserId: string | null = null;
    let verifiedEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user) {
          verifiedUserId = userData.user.id;
          verifiedEmail = userData.user.email ?? null;
        }
      } catch (e) {
        console.warn("validate-turno: token verification failed", e);
      }
    }

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
      .select("duracion_base_min, buffer_antes_min, buffer_despues_min, anticipacion_minima_reserva_min")
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

    // Enforce minimum booking lead time
    const antMin = Number((config as any)?.anticipacion_minima_reserva_min ?? 30);
    const slotMs = slotInstantMs(fecha, hora_inicio, timezone);
    const cutoffMs = Date.now() + antMin * 60000;
    if (slotMs < cutoffMs) {
      return new Response(JSON.stringify({
        error: "slot_too_soon",
        message: "Este horario ya no está disponible. Elegí un turno con mayor anticipación.",
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    // ===== Resolve final identity / snapshot fields =====
    const finalUserId = verifiedUserId; // never trust body.user_id
    const finalEmailRaw =
      verifiedEmail ||
      (typeof bodyClienteEmail === "string" ? bodyClienteEmail.trim() : null);
    const finalEmail = finalEmailRaw ? finalEmailRaw.toLowerCase() : null;
    const normalizePhone = (raw: string | null): string | null => {
      if (!raw) return null;
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const hasPlus = trimmed.startsWith("+");
      const digits = trimmed.replace(/\D/g, "");
      if (!digits) return null;
      return hasPlus ? `+${digits}` : digits;
    };

    const finalTelefono = normalizePhone(
      typeof cliente_telefono === "string" ? cliente_telefono : null,
    );
    const finalNombreSimple =
      typeof cliente_nombre_simple === "string" ? cliente_nombre_simple.trim() || null : null;
    const finalApellido =
      typeof cliente_apellido === "string" ? cliente_apellido.trim() || null : null;
    const finalFechaNac =
      typeof cliente_fecha_nacimiento === "string" && cliente_fecha_nacimiento.trim()
        ? cliente_fecha_nacimiento.trim()
        : null;
    const finalInstagram =
      typeof cliente_instagram === "string"
        ? cliente_instagram.trim().replace(/^@+/, "") || null
        : null;

    // ===== CRM sync (non-blocking) =====
    let clienteId: string | null = null;
    try {
      let cliente: any = null;

      if (finalEmail) {
        const { data } = await supabase
          .from("clientes")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("eliminado", false)
          .ilike("email", finalEmail)
          .limit(1)
          .maybeSingle();
        cliente = data;
      }
      if (!cliente && finalTelefono) {
        const { data } = await supabase
          .from("clientes")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("eliminado", false)
          .eq("telefono", finalTelefono)
          .limit(1)
          .maybeSingle();
        cliente = data;
      }
      if (!cliente && finalUserId) {
        // Fallback: cliente ya vinculado a este usuario en una reserva previa
        const { data: prevTurno } = await supabase
          .from("turnos")
          .select("cliente_id")
          .eq("organization_id", organization_id)
          .eq("user_id", finalUserId)
          .not("cliente_id", "is", null)
          .limit(1)
          .maybeSingle();
        if (prevTurno?.cliente_id) {
          const { data } = await supabase
            .from("clientes")
            .select("*")
            .eq("id", prevTurno.cliente_id)
            .eq("eliminado", false)
            .maybeSingle();
          cliente = data;
        }
      }

      if (!cliente) {
        const baseNombre = finalNombreSimple || cliente_nombre.trim();
        if (baseNombre) {
          const { data: nuevo, error: insertCliErr } = await supabase
            .from("clientes")
            .insert({
              organization_id,
              nombre: baseNombre,
              apellido: finalApellido,
              telefono: finalTelefono,
              email: finalEmail,
              fecha_nacimiento: finalFechaNac,
              instagram: finalInstagram,
              origen: "portal_publico",
              eliminado: false,
            })
            .select()
            .single();
          if (insertCliErr) {
            console.error("CRM: insert cliente failed", insertCliErr);
          } else {
            cliente = nuevo;
          }
        }
      } else {
        // soft patch: only fill empty fields
        const patch: Record<string, any> = {};
        const fillIfEmpty = (col: string, val: any) => {
          const cur = (cliente as any)[col];
          if (val && (cur == null || String(cur).trim() === "")) {
            patch[col] = val;
          }
        };
        fillIfEmpty("nombre", finalNombreSimple || cliente_nombre.trim());
        fillIfEmpty("apellido", finalApellido);
        fillIfEmpty("telefono", finalTelefono);
        fillIfEmpty("email", finalEmail);
        fillIfEmpty("fecha_nacimiento", finalFechaNac);
        fillIfEmpty("instagram", finalInstagram);
        if (Object.keys(patch).length > 0) {
          const { error: updErr } = await supabase
            .from("clientes")
            .update(patch)
            .eq("id", cliente.id)
            .eq("organization_id", organization_id);
          if (updErr) console.error("CRM: update cliente failed", updErr);
        }
      }

      if (cliente) {
        clienteId = cliente.id;
        const { data: rel } = await supabase
          .from("clientes_sucursales")
          .select("id")
          .eq("organization_id", organization_id)
          .eq("cliente_id", cliente.id)
          .eq("sucursal_id", sucursal_id)
          .maybeSingle();
        if (!rel) {
          const { error: relErr } = await supabase
            .from("clientes_sucursales")
            .insert({
              organization_id,
              cliente_id: cliente.id,
              sucursal_id,
              origen_relacion: "portal_publico",
            });
          if (relErr) console.error("CRM: insert clientes_sucursales failed", relErr);
        }
      }
    } catch (crmErr) {
      console.error("CRM sync error (non-blocking):", crmErr);
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
        cliente_telefono: finalTelefono,
        cliente_email: finalEmail,
        cliente_id: clienteId,
        user_id: finalUserId,
        estado: "pendiente",
        timezone,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
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
