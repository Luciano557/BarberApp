import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "owner" | "general_manager" | "manager" | "barber" | "otros";
type RolEquipo = "owner" | "general_manager" | "manager" | "barbero" | "otros";

interface Body {
  barberoId: string;
  organizationId: string;
  sucursalId?: string | null;
  accessEmail?: string | null; // null = clear, undefined = don't touch
  rolEquipo?: RolEquipo;
  regenerateAccess?: boolean;
}

const ROLE_RANK: Record<AppRole, number> = {
  owner: 0, general_manager: 1, manager: 2, barber: 3, otros: 4,
};

function rolEquipoToAppRole(r: RolEquipo): AppRole | null {
  if (r === "owner") return "owner";
  if (r === "general_manager") return "general_manager";
  if (r === "manager") return "manager";
  if (r === "barbero") return "barber";
  return null; // otros => no real role
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

function isEmail(s: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s);
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

    const body: Body = await req.json();
    const { barberoId, organizationId, sucursalId, accessEmail, rolEquipo, regenerateAccess } = body;

    if (!barberoId || !organizationId) {
      return jsonResponse(400, { error: "Datos incompletos" });
    }

    // Caller roles
    const { data: callerRolesData } = await admin
      .from("user_roles").select("role").eq("user_id", caller.id);
    const callerRoles: AppRole[] = (callerRolesData || []).map((r: any) => r.role);
    if (callerRoles.length === 0) return jsonResponse(403, { error: "Sin permisos" });

    // Caller must belong to org
    const { data: callerProfile } = await admin
      .from("profiles").select("organization_id").eq("id", caller.id).single();
    if (callerProfile?.organization_id !== organizationId) {
      return jsonResponse(403, { error: "Organización no coincide" });
    }

    const callerRank = Math.min(...callerRoles.map(r => ROLE_RANK[r] ?? 99));
    const isOwner = callerRoles.includes("owner");
    const isGM = callerRoles.includes("general_manager");
    const isManager = callerRoles.includes("manager");

    if (callerRoles.includes("barber") && !isOwner && !isGM && !isManager) {
      return jsonResponse(403, { error: "Sin permisos" });
    }

    // Load target barbero
    const { data: barbero, error: barberoErr } = await admin
      .from("barberos")
      .select("id, organization_id, sucursal_id, rol_equipo, access_email, nombre, apellido, activo")
      .eq("id", barberoId).single();
    if (barberoErr || !barbero) return jsonResponse(404, { error: "Miembro no encontrado" });
    if (barbero.organization_id !== organizationId) {
      return jsonResponse(403, { error: "Miembro de otra organización" });
    }

    // Find linked user (profile with barbero_id)
    const { data: linkedProfile } = await admin
      .from("profiles").select("id, email").eq("barbero_id", barberoId).maybeSingle();
    const targetUserId: string | null = linkedProfile?.id ?? null;

    // Existing target roles (for permission checks)
    let targetRoles: AppRole[] = [];
    if (targetUserId) {
      const { data: trData } = await admin
        .from("user_roles").select("role").eq("user_id", targetUserId);
      targetRoles = (trData || []).map((r: any) => r.role);
    }
    const targetIsOwner = targetRoles.includes("owner");
    const targetIsGM = targetRoles.includes("general_manager");

    // Manager restrictions
    if (isManager && !isOwner && !isGM) {
      if (targetIsOwner || targetIsGM) {
        return jsonResponse(403, { error: "No podés modificar a un dueño o encargado general" });
      }
      if (rolEquipo && (rolEquipo === "owner" || rolEquipo === "general_manager" || rolEquipo === "manager")) {
        return jsonResponse(403, { error: "No podés asignar este cargo" });
      }
    }
    // Only owner/GM can assign manager
    if (rolEquipo === "manager" && !isOwner && !isGM) {
      return jsonResponse(403, { error: "Solo dueño o encargado general pueden asignar Encargado" });
    }
    // Nobody downgrades the owner
    if (targetIsOwner && rolEquipo && rolEquipo !== "owner") {
      return jsonResponse(403, { error: "No se puede cambiar el cargo del dueño" });
    }

    // Validate manager uniqueness BEFORE any mutation
    const finalRolEquipo: RolEquipo = (rolEquipo ?? barbero.rol_equipo) as RolEquipo;
    const finalSucursalId = sucursalId ?? barbero.sucursal_id;

    if (finalRolEquipo === "manager") {
      if (!finalSucursalId) {
        return jsonResponse(400, { error: "El Encargado de Sucursal requiere una sucursal asignada" });
      }
      const { data: existingMgr } = await admin
        .from("barberos")
        .select("id, nombre, apellido")
        .eq("organization_id", organizationId)
        .eq("sucursal_id", finalSucursalId)
        .eq("rol_equipo", "manager")
        .eq("activo", true)
        .neq("id", barberoId);
      if (existingMgr && existingMgr.length > 0) {
        return jsonResponse(409, {
          error: `La sucursal ya tiene un Encargado activo (${existingMgr[0].nombre} ${existingMgr[0].apellido}). Cambiá su cargo antes de asignar otro.`,
        });
      }
    }

    // Email validation + uniqueness within org
    let emailToPersist: string | null | undefined = accessEmail;
    if (typeof accessEmail === "string") {
      if (accessEmail.trim() === "") {
        emailToPersist = null;
      } else {
        const e = accessEmail.trim().toLowerCase();
        if (!isEmail(e)) return jsonResponse(400, { error: "Email inválido" });
        emailToPersist = e;
        // Duplicate inside org (other barberos)
        const { data: dup } = await admin
          .from("barberos").select("id")
          .eq("organization_id", organizationId)
          .ilike("access_email", e)
          .neq("id", barberoId);
        if (dup && dup.length > 0) {
          return jsonResponse(409, { error: "Ya existe otro miembro con ese email" });
        }
      }
    }

    if (regenerateAccess) {
      const finalEmail = (typeof emailToPersist === "string" ? emailToPersist : barbero.access_email);
      if (!finalEmail) return jsonResponse(400, { error: "Falta email para generar acceso" });
      // Real role required
      const appRole = rolEquipoToAppRole(finalRolEquipo);
      if (!appRole) return jsonResponse(400, { error: "El cargo 'Otros' no permite acceso al sistema" });
    }

    // ===== MUTATIONS START =====
    // 1. Update barberos (access_email + rol_equipo + sucursal)
    const updates: any = {};
    if (emailToPersist !== undefined) updates.access_email = emailToPersist;
    if (rolEquipo !== undefined) updates.rol_equipo = rolEquipo;
    if (sucursalId !== undefined) updates.sucursal_id = sucursalId;

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await admin
        .from("barberos").update(updates).eq("id", barberoId);
      if (updErr) return jsonResponse(400, { error: `No se pudo actualizar miembro: ${updErr.message}` });
    }

    let tempPassword: string | null = null;
    let resultUserId: string | null = targetUserId;

    if (regenerateAccess) {
      const finalEmail = (typeof emailToPersist === "string" ? emailToPersist : barbero.access_email)!;
      const appRole = rolEquipoToAppRole(finalRolEquipo)!;
      tempPassword = generatePassword();
      const fullName = `${barbero.nombre} ${barbero.apellido}`.trim();

      // Find any auth user with that email
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find(u => u.email?.toLowerCase() === finalEmail.toLowerCase());

      if (existing) {
        const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, {
          password: tempPassword,
          email_confirm: true,
          user_metadata: { ...existing.user_metadata, full_name: fullName, must_change_password: true },
        });
        if (upErr) return jsonResponse(500, { error: `Auth: ${upErr.message}. Reintentá.` });
        resultUserId = existing.id;
      } else {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: finalEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName, must_change_password: true, invited_by: caller.id },
        });
        if (cErr || !created.user) return jsonResponse(500, { error: `Auth: ${cErr?.message ?? "error"}. Reintentá.` });
        resultUserId = created.user.id;
      }

      // Upsert profile (link barbero_id, org, email)
      const { error: pErr } = await admin
        .from("profiles")
        .upsert({
          id: resultUserId!,
          email: finalEmail,
          full_name: fullName,
          organization_id: organizationId,
          barbero_id: barberoId,
          default_sucursal_id: finalSucursalId ?? null,
        }, { onConflict: "id" });
      if (pErr) return jsonResponse(500, { error: `Perfil: ${pErr.message}. Estado: Auth creado, perfil incompleto. Reintentá.` });

      // user_roles: replace with single role
      await admin.from("user_roles").delete().eq("user_id", resultUserId!);
      const { error: rErr } = await admin
        .from("user_roles").insert({ user_id: resultUserId!, role: appRole });
      if (rErr) return jsonResponse(500, { error: `Cargo: ${rErr.message}. Reintentá.` });

      // user_sucursales sync
      if (finalSucursalId && (appRole === "manager" || appRole === "barber")) {
        await admin.from("user_sucursales").delete().eq("user_id", resultUserId!);
        await admin.from("user_sucursales").insert({
          user_id: resultUserId!,
          sucursal_id: finalSucursalId,
          organization_id: organizationId,
        });
      }
    } else if (targetUserId && (rolEquipo !== undefined || emailToPersist !== undefined || sucursalId !== undefined)) {
      // Sync existing user without regenerating password
      const fullName = `${barbero.nombre} ${barbero.apellido}`.trim();

      // Email change on registered user
      if (typeof emailToPersist === "string" && emailToPersist && emailToPersist !== linkedProfile?.email?.toLowerCase()) {
        const { error: eErr } = await admin.auth.admin.updateUserById(targetUserId, { email: emailToPersist, email_confirm: true });
        if (eErr) return jsonResponse(500, { error: `Auth email: ${eErr.message}` });
        await admin.from("profiles").update({ email: emailToPersist, full_name: fullName }).eq("id", targetUserId);
      }

      // Role sync
      if (rolEquipo !== undefined) {
        const appRole = rolEquipoToAppRole(rolEquipo);
        // Preserve owner
        if (!targetIsOwner) {
          await admin.from("user_roles").delete().eq("user_id", targetUserId);
          if (appRole) {
            await admin.from("user_roles").insert({ user_id: targetUserId, role: appRole });
          }
        }
      }

      // Sucursal sync
      if (finalSucursalId) {
        const { data: existingS } = await admin.from("user_sucursales")
          .select("id").eq("user_id", targetUserId).eq("sucursal_id", finalSucursalId).maybeSingle();
        if (!existingS) {
          await admin.from("user_sucursales").insert({
            user_id: targetUserId, sucursal_id: finalSucursalId, organization_id: organizationId,
          });
        }
        await admin.from("profiles").update({ default_sucursal_id: finalSucursalId }).eq("id", targetUserId);
      }
    }

    return jsonResponse(200, {
      ok: true,
      tempPassword,
      email: typeof emailToPersist === "string" ? emailToPersist : barbero.access_email,
      userId: resultUserId,
    });
  } catch (e: any) {
    console.error("update-team-member-access error:", e);
    return jsonResponse(500, { error: e?.message ?? "Error interno" });
  }
});
