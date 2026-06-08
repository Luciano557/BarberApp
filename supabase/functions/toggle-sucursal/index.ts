import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  sucursalId: string;
  organizationId: string;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(401, { error: "No autorizado" });

    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !caller) return jsonResponse(401, { error: "No autorizado" });

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Body inválido" });
    }
    const { sucursalId, organizationId } = body;
    if (!sucursalId || !organizationId) {
      return jsonResponse(400, { error: "Datos incompletos" });
    }

    // Verify caller belongs to org with proper role
    const { data: callerProfile } = await admin
      .from("profiles").select("organization_id").eq("id", caller.id).maybeSingle();
    if (callerProfile?.organization_id !== organizationId) {
      return jsonResponse(403, { error: "Organización no coincide" });
    }
    const { data: callerRolesData } = await admin
      .from("user_roles").select("role").eq("user_id", caller.id);
    const callerRoles = (callerRolesData || []).map((r: any) => r.role);
    if (!callerRoles.includes("owner") && !callerRoles.includes("general_manager")) {
      return jsonResponse(403, { error: "Sin permisos" });
    }

    // Verify sucursal exists in org
    const { data: suc, error: sErr } = await admin
      .from("sucursales")
      .select("id, organization_id, activa")
      .eq("id", sucursalId)
      .maybeSingle();
    if (sErr || !suc) return jsonResponse(404, { error: "Sucursal no encontrada" });
    if (suc.organization_id !== organizationId) {
      return jsonResponse(403, { error: "Sucursal de otra organización" });
    }

    if (suc.activa) {
      // ===== DESACTIVAR =====
      const { data: bsRows, error: bsErr } = await admin
        .from("barberos_sucursales")
        .select("barbero_id, disponible, tipo, dias_semana, fecha_inicio, fecha_fin")
        .eq("sucursal_id", sucursalId)
        .eq("organization_id", organizationId);
      if (bsErr) return jsonResponse(500, { error: `No se pudo leer el equipo: ${bsErr.message}` });

      const snapshotRows = (bsRows || []).map((r: any) => ({
        organization_id: organizationId,
        sucursal_id: sucursalId,
        barbero_id: r.barbero_id,
        disponible: !!r.disponible,
        tipo: r.tipo,
        dias_semana: r.dias_semana,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        snapshotted_at: new Date().toISOString(),
      }));

      if (snapshotRows.length > 0) {
        const { error: upsertErr } = await admin
          .from("sucursal_barberos_snapshot")
          .upsert(snapshotRows, { onConflict: "sucursal_id,barbero_id" });
        if (upsertErr) {
          return jsonResponse(500, { error: `No se pudo guardar snapshot: ${upsertErr.message}` });
        }
      }

      const { error: updBsErr } = await admin
        .from("barberos_sucursales")
        .update({ disponible: false })
        .eq("sucursal_id", sucursalId)
        .eq("organization_id", organizationId);
      if (updBsErr) {
        return jsonResponse(500, { error: `No se pudo bloquear el equipo: ${updBsErr.message}` });
      }

      const { error: updSucErr } = await admin
        .from("sucursales")
        .update({ activa: false, fecha_desactivacion: new Date().toISOString() })
        .eq("id", sucursalId)
        .eq("organization_id", organizationId);
      if (updSucErr) {
        return jsonResponse(500, { error: `No se pudo desactivar la sucursal: ${updSucErr.message}` });
      }

      return jsonResponse(200, { success: true, action: "deactivated", restored: false });
    } else {
      // ===== REACTIVAR =====
      const [{ data: snapRows, error: snapErr }, { data: currentRows, error: curErr }] = await Promise.all([
        admin
          .from("sucursal_barberos_snapshot")
          .select("barbero_id, disponible")
          .eq("sucursal_id", sucursalId)
          .eq("organization_id", organizationId),
        admin
          .from("barberos_sucursales")
          .select("barbero_id")
          .eq("sucursal_id", sucursalId)
          .eq("organization_id", organizationId),
      ]);
      if (snapErr) return jsonResponse(500, { error: `No se pudo leer snapshot: ${snapErr.message}` });
      if (curErr) return jsonResponse(500, { error: `No se pudo leer el equipo: ${curErr.message}` });

      const snap = (snapRows || []) as Array<{ barbero_id: string; disponible: boolean }>;
      const current = currentRows || [];
      const snapIds = new Set(snap.map((r) => r.barbero_id));
      const curIds = new Set(current.map((r: any) => r.barbero_id));

      let manualChanges = false;
      for (const id of snapIds) if (!curIds.has(id)) { manualChanges = true; break; }
      if (!manualChanges) {
        for (const id of curIds) if (!snapIds.has(id)) { manualChanges = true; break; }
      }

      let restored = false;
      let reason: string | undefined;

      if (!manualChanges && snap.length > 0) {
        for (const row of snap) {
          const { error: rErr } = await admin
            .from("barberos_sucursales")
            .update({ disponible: row.disponible })
            .eq("barbero_id", row.barbero_id)
            .eq("sucursal_id", sucursalId)
            .eq("organization_id", organizationId);
          if (rErr) {
            return jsonResponse(500, { error: `No se pudo restaurar disponibilidad: ${rErr.message}` });
          }
        }
        restored = true;
      } else if (manualChanges) {
        reason = "manual_changes_detected";
      }

      const { error: delErr } = await admin
        .from("sucursal_barberos_snapshot")
        .delete()
        .eq("sucursal_id", sucursalId)
        .eq("organization_id", organizationId);
      if (delErr) {
        return jsonResponse(500, { error: `No se pudo limpiar snapshot: ${delErr.message}` });
      }

      const { error: updSucErr } = await admin
        .from("sucursales")
        .update({ activa: true, fecha_desactivacion: null })
        .eq("id", sucursalId)
        .eq("organization_id", organizationId);
      if (updSucErr) {
        return jsonResponse(500, { error: `No se pudo reactivar la sucursal: ${updSucErr.message}` });
      }

      return jsonResponse(200, { success: true, action: "reactivated", restored, ...(reason ? { reason } : {}) });
    }
  } catch (e: any) {
    return jsonResponse(500, { error: e?.message || "Error interno" });
  }
});
