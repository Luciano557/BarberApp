import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body { sucursalId: string }

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
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(401, { error: "No autorizado" });

    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !caller) return jsonResponse(401, { error: "No autorizado" });

    let body: Body;
    try { body = await req.json(); } catch { return jsonResponse(400, { error: "Body inválido" }); }
    const { sucursalId } = body || ({} as Body);
    if (!sucursalId || typeof sucursalId !== "string") {
      return jsonResponse(400, { error: "sucursalId requerido" });
    }

    // Caller org + roles
    const { data: callerProfile } = await admin
      .from("profiles").select("organization_id").eq("id", caller.id).maybeSingle();
    const callerOrgId = callerProfile?.organization_id;
    if (!callerOrgId) return jsonResponse(403, { error: "Organización no encontrada" });

    const { data: rolesData } = await admin
      .from("user_roles").select("role").eq("user_id", caller.id);
    const roles = (rolesData || []).map((r: any) => r.role);
    if (!roles.includes("owner") && !roles.includes("general_manager")) {
      return jsonResponse(403, { error: "Solo Dueño o Encargado General puede eliminar sucursales" });
    }

    // Load sucursal
    const { data: suc, error: sErr } = await admin
      .from("sucursales")
      .select("id, organization_id, activa, deleted_at")
      .eq("id", sucursalId)
      .maybeSingle();
    if (sErr || !suc) return jsonResponse(404, { error: "Sucursal no encontrada" });
    if (suc.organization_id !== callerOrgId) {
      return jsonResponse(403, { error: "Sucursal de otra organización" });
    }
    if (suc.deleted_at) return jsonResponse(409, { error: "La sucursal ya está archivada" });
    if (suc.activa) return jsonResponse(409, { error: "Primero desactivá la sucursal" });

    // Historial check (used in response)
    const { data: hadHistData, error: hErr } = await admin
      .rpc("sucursal_tiene_historial", { _sucursal_id: sucursalId });
    if (hErr) return jsonResponse(500, { error: `No se pudo verificar historial: ${hErr.message}` });
    const hadHistory: boolean = !!hadHistData;

    // Soft-delete the sucursal
    const { error: updErr } = await admin
      .from("sucursales")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", sucursalId)
      .is("deleted_at", null);
    if (updErr) return jsonResponse(500, { error: `No se pudo archivar: ${updErr.message}` });

    // Best-effort: disable any cuenta de sucursal linked. `sucursal_accounts` has `estado` text.
    try {
      await admin
        .from("sucursal_accounts")
        .update({ estado: "Deshabilitada" })
        .eq("sucursal_id", sucursalId);
    } catch (_) { /* swallow — non-fatal */ }

    return jsonResponse(200, { ok: true, hadHistory });
  } catch (e: any) {
    return jsonResponse(500, { error: e?.message || "Error interno" });
  }
});
