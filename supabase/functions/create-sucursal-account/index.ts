import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, generateTempPassword, buildAccountEmail } from "../_shared/sucursal-account.ts";

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

    // Permission: owner / GM only. Manager does NOT create sucursal accounts.
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", requestingUser.id);
    const isOwnerOrGm = roles?.some((r) => r.role === "owner" || r.role === "general_manager");
    if (!isOwnerOrGm) {
      throw new Error("Sin permiso para crear la cuenta de esta sucursal");
    }

    // Load sucursal + org
    const { data: suc, error: sucErr } = await admin
      .from("sucursales")
      .select("id, nombre, organization_id")
      .eq("id", sucursalId)
      .maybeSingle();
    if (sucErr || !suc) throw new Error("Sucursal no encontrada");

    // Already exists?
    const { data: existing } = await admin
      .from("sucursal_accounts")
      .select("id, user_id, email")
      .eq("sucursal_id", sucursalId)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ alreadyExists: true, email: existing.email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const email = buildAccountEmail(suc.nombre, suc.id);
    const tempPassword = generateTempPassword();

    // Create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
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
    if (createErr || !created.user) throw new Error(createErr?.message || "No se pudo crear el usuario");
    const userId = created.user.id;

    // Insert profile, role, user_sucursales, sucursal_accounts
    const { error: profErr } = await admin.from("profiles").insert({
      id: userId,
      email,
      full_name: `Cuenta de sucursal — ${suc.nombre}`,
      organization_id: suc.organization_id,
      default_sucursal_id: suc.id,
    });
    if (profErr) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error("Error creando profile: " + profErr.message);
    }

    await admin.from("user_roles").insert({ user_id: userId, role: "sucursal_account" });
    await admin.from("user_sucursales").insert({
      user_id: userId,
      sucursal_id: suc.id,
      organization_id: suc.organization_id,
    });

    const { error: saErr } = await admin.from("sucursal_accounts").insert({
      organization_id: suc.organization_id,
      sucursal_id: suc.id,
      user_id: userId,
      email,
      estado: "Contraseña temporal",
      temp_password_pending: true,
    });
    if (saErr) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error("Error creando sucursal_account: " + saErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sucursalId: suc.id,
        email,
        tempPassword, // shown ONCE in UI
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("create-sucursal-account error:", e);
    return new Response(JSON.stringify({ error: e.message || "Error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
