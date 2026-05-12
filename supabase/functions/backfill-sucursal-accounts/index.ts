import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, generateTempPassword, buildAccountEmail } from "../_shared/sucursal-account.ts";

// Creates a sucursal_account for every active sucursal of the requesting user's org
// that does not have one yet. Returns the list of generated credentials (one-time view).

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user: requestingUser }, error: authErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !requestingUser) throw new Error("Unauthorized");

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", requestingUser.id);
    const isOwnerOrGm = roles?.some((r) => r.role === "owner" || r.role === "general_manager");
    if (!isOwnerOrGm) throw new Error("Solo Dueño o Encargado General puede ejecutar el backfill");

    const { data: profile } = await admin
      .from("profiles").select("organization_id").eq("id", requestingUser.id).maybeSingle();
    const orgId = profile?.organization_id;
    if (!orgId) throw new Error("Organización no encontrada");

    const { data: sucs, error: sucErr } = await admin
      .from("sucursales").select("id, nombre, organization_id")
      .eq("organization_id", orgId).eq("activa", true);
    if (sucErr) throw sucErr;

    const { data: existing } = await admin
      .from("sucursal_accounts").select("sucursal_id").eq("organization_id", orgId);
    const existingSet = new Set((existing || []).map((r) => r.sucursal_id));

    const created: Array<{ sucursalId: string; nombre: string; email: string; tempPassword: string }> = [];
    const errors: Array<{ sucursalId: string; nombre: string; error: string }> = [];

    for (const suc of sucs || []) {
      if (existingSet.has(suc.id)) continue;
      try {
        const email = buildAccountEmail(suc.nombre, suc.id);
        const tempPassword = generateTempPassword();
        const { data: createdUser, error: cErr } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: `Cuenta de sucursal — ${suc.nombre}`,
            sucursal_account: true,
            sucursal_id: suc.id,
            organization_id: suc.organization_id,
            must_change_password: true,
            temp_password_pending: true,
          },
        });
        if (cErr || !createdUser.user) throw new Error(cErr?.message || "auth create failed");
        const uid = createdUser.user.id;

        await admin.from("profiles").insert({
          id: uid, email, full_name: `Cuenta de sucursal — ${suc.nombre}`,
          organization_id: suc.organization_id, default_sucursal_id: suc.id,
        });
        await admin.from("user_roles").insert({ user_id: uid, role: "sucursal_account" });
        await admin.from("user_sucursales").insert({
          user_id: uid, sucursal_id: suc.id, organization_id: suc.organization_id,
        });
        await admin.from("sucursal_accounts").insert({
          organization_id: suc.organization_id,
          sucursal_id: suc.id,
          user_id: uid, email,
          estado: "Contraseña temporal",
          temp_password_pending: true,
        });

        created.push({ sucursalId: suc.id, nombre: suc.nombre, email, tempPassword });
      } catch (e: any) {
        console.error("backfill error for sucursal", suc.id, e);
        errors.push({ sucursalId: suc.id, nombre: suc.nombre, error: e.message || "error" });
      }
    }

    return new Response(JSON.stringify({ success: true, created, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("backfill-sucursal-accounts error:", e);
    return new Response(JSON.stringify({ error: e.message || "Error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
