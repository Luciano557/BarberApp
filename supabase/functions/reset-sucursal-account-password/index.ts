import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, generateTempPassword } from "../_shared/sucursal-account.ts";

interface Req {
  sucursalId: string;
}

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

    const { sucursalId }: Req = await req.json();
    if (!sucursalId) throw new Error("sucursalId requerido");

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", requestingUser.id);
    const isOwnerOrGm = roles?.some((r) => r.role === "owner" || r.role === "general_manager");
    let allowed = !!isOwnerOrGm;
    if (!allowed) {
      const { data: us } = await admin
        .from("user_sucursales")
        .select("sucursal_id")
        .eq("user_id", requestingUser.id)
        .eq("sucursal_id", sucursalId)
        .maybeSingle();
      allowed = !!us && roles?.some((r) => r.role === "manager") === true;
    }
    if (!allowed) throw new Error("Sin permiso");

    const { data: sa, error } = await admin
      .from("sucursal_accounts")
      .select("id, user_id, email")
      .eq("sucursal_id", sucursalId)
      .maybeSingle();
    if (error || !sa) throw new Error("Cuenta de sucursal no encontrada");

    const tempPassword = generateTempPassword();

    const { error: upErr } = await admin.auth.admin.updateUserById(sa.user_id, {
      password: tempPassword,
      user_metadata: {
        sucursal_account: true,
        must_change_password: true,
        temp_password_pending: true,
      },
    });
    if (upErr) throw new Error(upErr.message);

    // Force logout of all sessions for this account
    await admin.auth.admin.signOut(sa.user_id, "global");

    await admin
      .from("sucursal_accounts")
      .update({
        estado: "Contraseña temporal",
        temp_password_pending: true,
        last_password_reset_at: new Date().toISOString(),
      })
      .eq("id", sa.id);

    return new Response(
      JSON.stringify({ success: true, email: sa.email, tempPassword }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("reset-sucursal-account-password error:", e);
    return new Response(JSON.stringify({ error: e.message || "Error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
