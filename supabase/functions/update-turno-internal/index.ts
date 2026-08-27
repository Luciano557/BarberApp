// Edita servicio/barbero/fecha/hora de un turno desde la agenda interna.
// Autorización basada en rol + acceso a la sucursal del turno.
// Solo esta función puede setear turnos.overlap_autorizado = true.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  findConflictingTurnos,
  isBlockedByBloqueo,
  isWithinWorkingHours,
  minutesToTime,
  slotInstantMs,
  timeToMinutes,
} from "../_shared/availability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HH_MM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YYYY_MM_DD_RE = /^\d{4}-\d{2}-\d{2}$/;

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  try {
    // ------------------------- Auth -------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "unauthorized" });
    }
    const token = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(401, { error: "unauthorized" });
    }
    const userId = userData.user.id;

    const supabase = createClient(supabaseUrl, serviceKey);

    // ------------------------- Input -------------------------
    let body: any;
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

    const {
      turno_id,
      servicio_id,
      barbero_id,
      fecha,
      hora_inicio,
      confirm_overlap,
      confirm_fuera_horario,
    } = body ?? {};

    if (typeof turno_id !== "string" || !turno_id) {
      return json(400, { error: "missing_turno_id" });
    }
    if (fecha !== undefined && (typeof fecha !== "string" || !YYYY_MM_DD_RE.test(fecha))) {
      return json(400, { error: "invalid_fecha" });
    }
    if (hora_inicio !== undefined && (typeof hora_inicio !== "string" || !HH_MM_RE.test(hora_inicio))) {
      return json(400, { error: "invalid_hora_inicio" });
    }
    if (servicio_id !== undefined && typeof servicio_id !== "string") {
      return json(400, { error: "invalid_servicio_id" });
    }
    if (barbero_id !== undefined && typeof barbero_id !== "string") {
      return json(400, { error: "invalid_barbero_id" });
    }
    const overlapConfirmed = confirm_overlap === true;
    const fueraHorarioConfirmed = confirm_fuera_horario === true;

    // ------------------------- Load turno -------------------------
    const { data: turno, error: turnoErr } = await supabase
      .from("turnos")
      .select("id, organization_id, sucursal_id, barbero_id, servicio_id, fecha, hora_inicio, hora_fin, estado")
      .eq("id", turno_id)
      .maybeSingle();
    if (turnoErr) {
      console.error("update-turno-internal load turno error:", turnoErr);
      return json(500, { error: "internal_error" });
    }
    if (!turno) return json(404, { error: "turno_no_encontrado" });

    if (!["pendiente", "confirmado", "en_curso"].includes(turno.estado)) {
      return json(409, { error: "turno_cerrado" });
    }

    // ------------------------- Authorization -------------------------
    // 1) Misma organización que el turno (por profiles).
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) {
      console.error("update-turno-internal profile error:", profileErr);
      return json(500, { error: "internal_error" });
    }
    if (!profile || profile.organization_id !== turno.organization_id) {
      return json(403, { error: "forbidden" });
    }

    // 2) Rol permitido.
    const { data: rolesRows, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) {
      console.error("update-turno-internal roles error:", rolesErr);
      return json(500, { error: "internal_error" });
    }
    const allowedRoles = new Set(["owner", "general_manager", "manager", "barber", "sucursal_account"]);
    const heldRoles = new Set((rolesRows || []).map((r: any) => r.role));
    const hasAllowedRole = [...heldRoles].some((r) => allowedRoles.has(r as string));
    if (!hasAllowedRole) return json(403, { error: "forbidden" });


    // 2) Alcance de sucursal: owner/general_manager acceden a cualquier sucursal
    //    de la org; manager/barber/sucursal_account deben tener la sucursal en
    //    user_sucursales.
    const orgWideRoles = heldRoles.has("owner") || heldRoles.has("general_manager");
    if (!orgWideRoles) {
      const { data: sucRows, error: sucErr } = await supabase
        .from("user_sucursales")
        .select("sucursal_id")
        .eq("user_id", userId);
      if (sucErr) {
        console.error("update-turno-internal user_sucursales error:", sucErr);
        return json(500, { error: "internal_error" });
      }
      const sucursalIds = new Set((sucRows || []).map((r: any) => r.sucursal_id));
      if (!sucursalIds.has(turno.sucursal_id)) {
        return json(403, { error: "forbidden" });
      }
    }

    // ------------------------- Resolve final values -------------------------
    const finalServicioId: string = servicio_id ?? turno.servicio_id;
    const finalBarberoId: string = barbero_id ?? turno.barbero_id;
    const finalFecha: string = fecha ?? turno.fecha;
    const finalHoraInicio: string = hora_inicio ?? turno.hora_inicio.slice(0, 5);

    // Servicio final → duración
    const { data: servicio, error: servErr } = await supabase
      .from("servicios")
      .select("id, duracion_min, organization_id")
      .eq("id", finalServicioId)
      .maybeSingle();
    if (servErr || !servicio) return json(404, { error: "servicio_no_encontrado" });
    if (servicio.organization_id !== turno.organization_id) {
      return json(400, { error: "servicio_de_otra_organizacion" });
    }

    // Barbero final → misma org, activo, disponible en la sucursal
    const { data: barbero, error: barbErr } = await supabase
      .from("barberos")
      .select("id, organization_id, activo")
      .eq("id", finalBarberoId)
      .maybeSingle();
    if (barbErr || !barbero) return json(404, { error: "barbero_no_encontrado" });
    if (barbero.organization_id !== turno.organization_id) {
      return json(400, { error: "barbero_de_otra_organizacion" });
    }
    if (!barbero.activo) return json(409, { error: "barbero_inactivo" });

    const { data: bs } = await supabase
      .from("barberos_sucursales")
      .select("barbero_id")
      .eq("organization_id", turno.organization_id)
      .eq("sucursal_id", turno.sucursal_id)
      .eq("barbero_id", finalBarberoId)
      .eq("disponible", true)
      .maybeSingle();
    if (!bs) return json(409, { error: "barbero_no_disponible_en_sucursal" });

    // ------------------------- Timezone -------------------------
    const [{ data: suc }, { data: org }, { data: config }] = await Promise.all([
      supabase.from("sucursales").select("timezone, deleted_at, activa").eq("id", turno.sucursal_id).maybeSingle(),
      supabase.from("organizations").select("timezone").eq("id", turno.organization_id).maybeSingle(),
      supabase.from("agenda_config").select("buffer_antes_min, buffer_despues_min").eq("organization_id", turno.organization_id).eq("sucursal_id", turno.sucursal_id).maybeSingle(),
    ]);

    if (!suc || (suc as any).deleted_at || (suc as any).activa === false) {
      return json(404, { error: "sucursal_no_disponible" });
    }
    const timezone = (suc as any)?.timezone || (org as any)?.timezone || "America/Argentina/Buenos_Aires";

    const duracion = Number((servicio as any).duracion_min) || 30;
    const finalHoraFin = minutesToTime(timeToMinutes(finalHoraInicio) + duracion);

    // ------------------------- No en el pasado -------------------------
    const slotMs = slotInstantMs(finalFecha, finalHoraInicio, timezone);
    if (slotMs < Date.now()) {
      return json(409, { error: "slot_en_pasado" });
    }

    const slotStartMin = timeToMinutes(finalHoraInicio);
    const slotEndMin = timeToMinutes(finalHoraFin);

    // ------------------------- Bloqueos (siempre bloquean) -------------------------
    const isBlocked = await isBlockedByBloqueo(supabase, {
      orgId: turno.organization_id,
      sucursalId: turno.sucursal_id,
      barberoId: finalBarberoId,
      fecha: finalFecha,
      slotStartMin,
      slotEndMin,
    });
    if (isBlocked) return json(409, { error: "slot_bloqueado" });

    // ------------------------- Fuera de horario (confirmable) -------------------------
    const inWorkingHours = await isWithinWorkingHours(supabase, {
      orgId: turno.organization_id,
      sucursalId: turno.sucursal_id,
      barberoId: finalBarberoId,
      fecha: finalFecha,
      slotStartMin,
      slotEndMin,
    });
    if (!inWorkingHours && !fueraHorarioConfirmed) {
      return json(409, {
        error: "fuera_de_horario",
        detalle: {
          barbero_id: finalBarberoId,
          fecha: finalFecha,
          hora_inicio: finalHoraInicio,
          hora_fin: finalHoraFin,
        },
      });
    }

    // ------------------------- Choque de horario (confirmable) -------------------------
    const bufferBefore = Number((config as any)?.buffer_antes_min) || 0;
    const bufferAfter = Number((config as any)?.buffer_despues_min) || 0;

    const conflicts = await findConflictingTurnos(supabase, {
      organizationId: turno.organization_id,
      sucursalId: turno.sucursal_id,
      barberoId: finalBarberoId,
      fecha: finalFecha,
      hora_inicio: finalHoraInicio,
      hora_fin: finalHoraFin,
      bufferBefore,
      bufferAfter,
      excludeTurnoId: turno.id,
    });

    const overlapAutorizado = conflicts.length > 0 ? overlapConfirmed : false;

    if (conflicts.length > 0 && !overlapConfirmed) {
      return json(409, {
        error: "choque_de_horario",
        conflicts: conflicts.map((c) => ({
          id: c.id,
          hora_inicio: String(c.hora_inicio).slice(0, 5),
          hora_fin: String(c.hora_fin).slice(0, 5),
          cliente_nombre: c.cliente_nombre,
        })),
      });
    }

    // ------------------------- UPDATE -------------------------
    const { data: updated, error: updErr } = await supabase
      .from("turnos")
      .update({
        servicio_id: finalServicioId,
        barbero_id: finalBarberoId,
        fecha: finalFecha,
        hora_inicio: finalHoraInicio,
        hora_fin: finalHoraFin,
        overlap_autorizado: overlapAutorizado,
      })
      .eq("id", turno.id)
      .select()
      .single();

    if (updErr) {
      console.error("update-turno-internal update error:", updErr);
      if ((updErr as any).code === "23P01") {
        return json(409, { error: "horario_ocupado" });
      }
      return json(500, { error: "internal_error" });
    }

    return json(200, { success: true, turno: updated });
  } catch (e) {
    console.error("update-turno-internal fatal error:", e);
    return json(500, { error: "internal_error" });
  }
});
