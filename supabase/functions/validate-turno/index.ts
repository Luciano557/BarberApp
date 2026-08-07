import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { canonicalPhoneOrNull } from "../_shared/phone.ts";

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
      cliente_apellido,
      cliente_telefono,
      cliente_email,
      cliente_fecha_nacimiento,
      eligio_barbero,
    } = body;
    const eligioBarberoFinal = eligio_barbero ?? false;

    if (!organization_id || !sucursal_id || !barbero_id || !servicio_id || !fecha || !hora_inicio) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalNombre = typeof cliente_nombre === "string" ? cliente_nombre.trim() : "";
    if (!finalNombre || finalNombre.length < 2) {
      return new Response(JSON.stringify({ error: "Invalid client name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalTelefono = canonicalPhoneOrNull(cliente_telefono);
    if (!finalTelefono) {
      return new Response(JSON.stringify({
        error: "invalid_phone",
        message: "Teléfono inválido. Ingresá un móvil argentino (ej: 11 2516-2528).",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalApellido = typeof cliente_apellido === "string" ? cliente_apellido.trim() || null : null;
    const finalEmail = typeof cliente_email === "string" && cliente_email.trim()
      ? cliente_email.trim().toLowerCase()
      : null;
    const finalFechaNac = typeof cliente_fecha_nacimiento === "string" && cliente_fecha_nacimiento.trim()
      ? cliente_fecha_nacimiento.trim()
      : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Disponibilidad del barbero en la sucursal (Fase 3)
    const { data: bsRow } = await supabase
      .from("barberos_sucursales")
      .select("barbero_id")
      .eq("organization_id", organization_id)
      .eq("sucursal_id", sucursal_id)
      .eq("barbero_id", barbero_id)
      .eq("disponible", true)
      .maybeSingle();

    if (!bsRow) {
      return new Response(
        JSON.stringify({
          error: "barber_not_available_in_sucursal",
          message: "Este barbero ya no está disponible en esta sucursal. Elegí otro barbero.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const { data: config } = await supabase
      .from("agenda_config")
      .select("duracion_base_min, buffer_antes_min, buffer_despues_min, anticipacion_minima_reserva_min")
      .eq("organization_id", organization_id)
      .eq("sucursal_id", sucursal_id)
      .single();

    const duracion = servicio.duracion_min || config?.duracion_base_min || 30;
    const hora_fin = minutesToTime(timeToMinutes(hora_inicio) + duracion);

    const { data: sucursal } = await supabase
      .from("sucursales")
      .select("timezone, deleted_at, activa")
      .eq("id", sucursal_id)
      .single();

    if (!sucursal || (sucursal as any).deleted_at || (sucursal as any).activa === false) {
      return new Response(JSON.stringify({ error: "Sucursal no disponible" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", organization_id)
      .single();

    const timezone = sucursal?.timezone || org?.timezone || "America/Argentina/Buenos_Aires";

    const antMin = Number((config as any)?.anticipacion_minima_reserva_min ?? 30);
    const slotMs = slotInstantMs(fecha, hora_inicio, timezone);
    const cutoffMs = Date.now() + antMin * 60000;
    if (slotMs < cutoffMs) {
      return new Response(JSON.stringify({
        error: "slot_too_soon",
        message: "Este horario ya no está disponible. Elegí un turno con mayor anticipación.",
        antMin,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validar horario de apertura del barbero/sucursal para ese día
    const [Y, M, D] = fecha.split("-").map(Number);
    const jsDow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
    const dbDow = jsDow === 0 ? 7 : jsDow;

    const { data: horariosData } = await supabase
      .from("horarios_trabajo")
      .select("barbero_id, hora_inicio, hora_fin")
      .eq("organization_id", organization_id)
      .eq("sucursal_id", sucursal_id)
      .eq("dia_semana", dbDow)
      .eq("activo", true)
      .or(`barbero_id.eq.${barbero_id},barbero_id.is.null`);

    const horariosAll = horariosData || [];
    const horariosOverride = horariosAll.filter((h: any) => h.barbero_id === barbero_id);
    const horariosResolved = horariosOverride.length > 0
      ? horariosOverride
      : horariosAll.filter((h: any) => h.barbero_id === null);

    const slotStartMin = timeToMinutes(hora_inicio);
    const slotEndMin = timeToMinutes(hora_fin);
    const inWorkingHours = horariosResolved.some((h: any) =>
      timeToMinutes(h.hora_inicio) <= slotStartMin && timeToMinutes(h.hora_fin) >= slotEndMin
    );

    if (!inWorkingHours) {
      return new Response(JSON.stringify({
        error: "outside_working_hours",
        message: "Ese horario está fuera del horario de atención del barbero.",
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validar bloqueos de agenda
    const { data: bloqueosData } = await supabase
      .from("bloqueos_agenda")
      .select("barbero_id, hora_inicio, hora_fin, todo_el_dia")
      .eq("organization_id", organization_id)
      .eq("sucursal_id", sucursal_id)
      .lte("fecha_inicio", fecha)
      .gte("fecha_fin", fecha);

    const bloqueosRelevant = (bloqueosData || []).filter(
      (b: any) => b.barbero_id === barbero_id || b.barbero_id === null
    );
    const isBlocked = bloqueosRelevant.some((b: any) => {
      if (b.todo_el_dia) return true;
      if (!b.hora_inicio || !b.hora_fin) return false;
      const bStart = timeToMinutes(b.hora_inicio);
      const bEnd = timeToMinutes(b.hora_fin);
      return bStart < slotEndMin && bEnd > slotStartMin;
    });

    if (isBlocked) {
      return new Response(JSON.stringify({
        error: "slot_blocked",
        message: "Ese horario está bloqueado en la agenda.",
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const bufferBefore = config?.buffer_antes_min || 0;
    const bufferAfter = config?.buffer_despues_min || 0;
    const checkStart = minutesToTime(timeToMinutes(hora_inicio) - bufferBefore);
    const checkEnd = minutesToTime(timeToMinutes(hora_fin) + bufferAfter);

    const { data: conflicts } = await supabase
      .from("turnos")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("sucursal_id", sucursal_id)
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
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // ===== CRM sync: phone-first match within org =====
    let clienteId: string | null = null;
    type CrmFailure = { stage: 'insert_cliente' | 'update_cliente' | 'insert_relacion' | 'crm_sync'; code: string | null; message: string };
    let crmFailure: CrmFailure | null = null;

    try {
      let cliente: any = null;

      const { data: matchByPhone } = await supabase
        .from("clientes")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("eliminado", false)
        .eq("telefono", finalTelefono)
        .limit(1)
        .maybeSingle();
      cliente = matchByPhone;

      if (!cliente && finalEmail) {
        const { data: matchByEmail } = await supabase
          .from("clientes")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("eliminado", false)
          .ilike("email", finalEmail)
          .limit(1)
          .maybeSingle();
        cliente = matchByEmail;
      }

      if (!cliente) {
        const { data: nuevo, error: insertCliErr } = await supabase
          .from("clientes")
          .insert({
            organization_id,
            nombre: finalNombre,
            apellido: finalApellido,
            telefono: finalTelefono,
            email: finalEmail,
            fecha_nacimiento: finalFechaNac,
            origen: "reserva",
            eliminado: false,
          })
          .select()
          .single();
        if (insertCliErr) {
          crmFailure = { stage: 'insert_cliente', code: (insertCliErr as any).code ?? null, message: insertCliErr.message };
        } else {
          cliente = nuevo;
        }
      } else {
        // Overwrite always: latest input wins for these fields.
        const { error: updErr } = await supabase
          .from("clientes")
          .update({
            nombre: finalNombre,
            apellido: finalApellido,
            telefono: finalTelefono,
            email: finalEmail,
            fecha_nacimiento: finalFechaNac,
          })
          .eq("id", cliente.id)
          .eq("organization_id", organization_id);
        if (updErr) {
          crmFailure = { stage: 'update_cliente', code: (updErr as any).code ?? null, message: updErr.message };
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
              origen_relacion: "reserva",
            });
          if (relErr && !crmFailure) {
            crmFailure = { stage: 'insert_relacion', code: (relErr as any).code ?? null, message: relErr.message };
          }
        }
      }
    } catch (crmErr) {
      crmFailure = {
        stage: 'crm_sync',
        code: (crmErr as any)?.code ?? null,
        message: (crmErr as any)?.message ?? String(crmErr),
      };
    }

    const nombreCompleto = [finalNombre, finalApellido].filter(Boolean).join(" ").trim();

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
        cliente_nombre: nombreCompleto || finalNombre,
        cliente_telefono: finalTelefono,
        cliente_email: finalEmail,
        cliente_id: clienteId,
        user_id: null,
        estado: "pendiente",
        timezone,
        eligio_barbero: eligioBarberoFinal,
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
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "Failed to create appointment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== CRM sync failure: log and persist without blocking the reservation =====
    if (crmFailure && turno) {
      const turnoId = (turno as any).id as string;
      const { stage, code, message } = crmFailure;
      console.error('[validate-turno][crm_sync_fallo]', { turno_id: turnoId, stage, code, message });
      try {
        const detalle = JSON.stringify({ stage, code, message, at: new Date().toISOString() });
        await supabase
          .from('turnos')
          .update({ crm_sync_error: detalle })
          .eq('id', turnoId);
      } catch (reportErr) {
        console.error('[validate-turno][crm_sync_fallo][persist_failed]', reportErr);
      }
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
