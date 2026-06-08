import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  barberoId: string;
  organizationId: string;
  motivo?: string | null;
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
    const { barberoId, organizationId } = body;
    const motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 240) : null;

    if (!barberoId || !organizationId) {
      return jsonResponse(400, { error: "Datos incompletos" });
    }

    // Caller: must belong to org and have owner/general_manager role
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

    // Target barbero
    const { data: barbero, error: bErr } = await admin
      .from("barberos")
      .select("id, organization_id, rol_equipo, roles_equipo, activo")
      .eq("id", barberoId).maybeSingle();
    if (bErr || !barbero) return jsonResponse(404, { error: "Miembro no encontrado" });
    if (barbero.organization_id !== organizationId) {
      return jsonResponse(403, { error: "Miembro de otra organización" });
    }
    const targetIsOwner =
      barbero.rol_equipo === "owner" ||
      (Array.isArray(barbero.roles_equipo) && barbero.roles_equipo.includes("owner"));
    if (targetIsOwner) {
      return jsonResponse(403, { error: "No se puede finalizar la actividad del dueño" });
    }
    if (!barbero.activo) {
      return jsonResponse(400, { error: "El miembro ya está inactivo" });
    }

    // Linked auth user (optional)
    const { data: linkedProfile } = await admin
      .from("profiles").select("id").eq("barbero_id", barberoId).maybeSingle();
    const targetUserId: string | null = linkedProfile?.id ?? null;

    // Ban the auth user (if any) so they can't log in
    if (targetUserId) {
      const { error: banErr } = await (admin.auth.admin as any).updateUserById(targetUserId, {
        ban_duration: "876000h",
      });
      if (banErr) {
        return jsonResponse(500, { error: `No se pudo bloquear el acceso: ${banErr.message}` });
      }
    }

    // Update barberos
    const { error: updErr } = await admin
      .from("barberos")
      .update({
        activo: false,
        fecha_baja: new Date().toISOString().slice(0, 10),
        motivo_baja: motivo,
      })
      .eq("id", barberoId)
      .eq("organization_id", organizationId);

    if (updErr) {
      // Rollback: unban
      if (targetUserId) {
        await (admin.auth.admin as any).updateUserById(targetUserId, { ban_duration: "none" });
      }
      return jsonResponse(500, { error: `No se pudo finalizar la actividad: ${updErr.message}` });
    }

    return jsonResponse(200, { ok: true });
  } catch (e: any) {
    return jsonResponse(500, { error: e?.message || "Error interno" });
  }
});
