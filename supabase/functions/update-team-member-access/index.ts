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
  accessEmail?: string | null;
  roles?: AppRole[]; // multi-role (preferred)
  rolEquipo?: RolEquipo; // legacy compat
  regenerateAccess?: boolean;
  replaceExistingManager?: boolean;
  existingManagerBarberoId?: string | null;
  resolveStaleManagerConflict?: boolean;
}

const ROLE_RANK: Record<AppRole, number> = {
  owner: 0, general_manager: 1, manager: 2, barber: 3, otros: 4,
};

function rolesToRolEquipo(roles: AppRole[]): RolEquipo {
  if (roles.includes("owner")) return "owner";
  if (roles.includes("general_manager")) return "general_manager";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("barber")) return "barbero";
  return "otros";
}

function rolEquipoToRoles(re: RolEquipo): AppRole[] {
  if (re === "owner") return ["owner"];
  if (re === "general_manager") return ["general_manager"];
  if (re === "manager") return ["manager"];
  if (re === "barbero") return ["barber"];
  return ["otros"];
}

function normalizeRoles(input: AppRole[]): AppRole[] {
  const set = new Set(input.filter(r => ["owner","general_manager","manager","barber","otros"].includes(r)));
  if (set.has("otros")) return ["otros"]; // exclusive
  // hierarchical: keep only the highest one
  const hier: AppRole[] = ["owner","general_manager","manager"].filter(r => set.has(r as AppRole)) as AppRole[];
  const top = hier[0]; // highest
  const out: AppRole[] = [];
  if (top) out.push(top);
  if (set.has("barber")) out.push("barber");
  if (out.length === 0) out.push("barber");
  return out;
}

function validateRolesCombination(roles: AppRole[]): string | null {
  if (roles.length === 0) return "Debe tener al menos un cargo";
  const unique = Array.from(new Set(roles));
  if (unique.includes("otros") && unique.length > 1) return "El cargo 'Otros' no puede combinarse con otros";
  const hierCount = ["owner","general_manager","manager"].filter(r => unique.includes(r as AppRole)).length;
  if (hierCount > 1) return "Solo puede haber un cargo jerárquico (owner/general_manager/manager)";
  for (const r of unique) {
    if (!["owner","general_manager","manager","barber","otros"].includes(r)) return `Cargo inválido: ${r}`;
  }
  return null;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Fase 7: reject if email already belongs to a different auth.users user
async function checkEmailConflict(
  admin: any,
  email: string,
  ignoreUserId: string | null,
  organizationId: string,
): Promise<{ status: number; body: any } | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === e);
  if (!existing) return null;
  if (ignoreUserId && existing.id === ignoreUserId) return null;
  const { data: ownerRow } = await admin
    .from("user_roles").select("role").eq("user_id", existing.id).eq("role", "owner").maybeSingle();
  const { data: prof } = await admin
    .from("profiles").select("organization_id").eq("id", existing.id).maybeSingle();
  const isOrgOwner = !!ownerRow && prof?.organization_id === organizationId;
  return {
    status: 409,
    body: {
      error: isOrgOwner
        ? "Este email pertenece al dueño de la organización."
        : "Este email ya está registrado en el sistema.",
      code: isOrgOwner ? "EMAIL_BELONGS_TO_OWNER" : "EMAIL_ALREADY_REGISTERED",
    },
  };
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
    const { barberoId, organizationId, sucursalId, accessEmail, regenerateAccess,
            replaceExistingManager, existingManagerBarberoId, resolveStaleManagerConflict } = body;

    if (!barberoId || !organizationId) {
      return jsonResponse(400, { error: "Datos incompletos" });
    }

    // Resolve roles array (preferred) or fall back to single rolEquipo
    let rolesInput: AppRole[] | undefined = undefined;
    if (body.roles !== undefined) {
      rolesInput = body.roles;
    } else if (body.rolEquipo !== undefined) {
      rolesInput = rolEquipoToRoles(body.rolEquipo);
    }

    let normalizedRoles: AppRole[] | undefined = undefined;
    if (rolesInput !== undefined) {
      const err = validateRolesCombination(rolesInput);
      if (err) return jsonResponse(400, { error: err });
      normalizedRoles = normalizeRoles(rolesInput);
    }

    // Caller roles
    const { data: callerRolesData } = await admin
      .from("user_roles").select("role").eq("user_id", caller.id);
    const callerRoles: AppRole[] = (callerRolesData || []).map((r: any) => r.role);
    if (callerRoles.length === 0) return jsonResponse(403, { error: "Sin permisos" });

    const { data: callerProfile } = await admin
      .from("profiles").select("organization_id").eq("id", caller.id).single();
    if (callerProfile?.organization_id !== organizationId) {
      return jsonResponse(403, { error: "Organización no coincide" });
    }

    const isOwner = callerRoles.includes("owner");
    const isGM = callerRoles.includes("general_manager");
    const isManager = callerRoles.includes("manager");

    if (!isOwner && !isGM && !isManager) {
      return jsonResponse(403, { error: "Sin permisos" });
    }

    // Load target barbero
    const { data: barbero, error: barberoErr } = await admin
      .from("barberos")
      .select("id, organization_id, sucursal_id, rol_equipo, roles_equipo, access_email, nombre, apellido, activo")
      .eq("id", barberoId).single();
    if (barberoErr || !barbero) return jsonResponse(404, { error: "Miembro no encontrado" });
    if (barbero.organization_id !== organizationId) {
      return jsonResponse(403, { error: "Miembro de otra organización" });
    }

    // Guard: la ficha del dueño no se administra desde esta función.
    const targetIsOwnerHard =
      barbero.rol_equipo === "owner" ||
      (Array.isArray(barbero.roles_equipo) && barbero.roles_equipo.includes("owner"));
    if (targetIsOwnerHard) {
      return jsonResponse(403, { error: "La ficha del dueño no se administra desde acá" });
    }

    const { data: linkedProfile } = await admin
      .from("profiles").select("id, email").eq("barbero_id", barberoId).maybeSingle();
    const targetUserId: string | null = linkedProfile?.id ?? null;

    let targetRoles: AppRole[] = [];
    if (targetUserId) {
      const { data: trData } = await admin
        .from("user_roles").select("role").eq("user_id", targetUserId);
      targetRoles = (trData || []).map((r: any) => r.role);
    }
    const targetIsOwner = targetRoles.includes("owner") || (barbero.roles_equipo || []).includes("owner");
    const targetIsGM = targetRoles.includes("general_manager") || (barbero.roles_equipo || []).includes("general_manager");

    // Permissions on role assignment
    if (normalizedRoles) {
      // Manager restrictions
      if (isManager && !isOwner && !isGM) {
        if (targetIsOwner || targetIsGM) {
          return jsonResponse(403, { error: "No podés modificar a un dueño o encargado general" });
        }
        if (normalizedRoles.some(r => r === "owner" || r === "general_manager" || r === "manager")) {
          return jsonResponse(403, { error: "No podés asignar este cargo" });
        }
      }
      // Only owner can grant/keep owner role; nobody else can assign owner
      if (normalizedRoles.includes("owner") && !isOwner) {
        return jsonResponse(403, { error: "Solo el dueño puede asignar el cargo 'Dueño'" });
      }
      // Only owner/GM can assign manager
      if (normalizedRoles.includes("manager") && !isOwner && !isGM) {
        return jsonResponse(403, { error: "Solo dueño o encargado general pueden asignar Encargado" });
      }
      // Only owner can assign general_manager
      if (normalizedRoles.includes("general_manager") && !isOwner) {
        return jsonResponse(403, { error: "Solo el dueño puede asignar Encargado General" });
      }
      // Owner cannot be downgraded by anyone (including owner removing their own)
      if (targetIsOwner && !normalizedRoles.includes("owner")) {
        return jsonResponse(403, { error: "No se puede quitar el cargo de dueño" });
      }
    }

    const finalSucursalId = sucursalId ?? barbero.sucursal_id;

    // Manager uniqueness BEFORE any mutation — distinguishes:
    //  A) Real visible conflict (another barbero in branch with manager role/roles_equipo)
    //  B) Stale conflict (user_roles.manager + user_sucursales but no visible barbero)
    if (normalizedRoles && normalizedRoles.includes("manager")) {
      if (!finalSucursalId) {
        return jsonResponse(400, { error: "El Encargado de Sucursal requiere una sucursal asignada" });
      }

      const callerIsOwnerOrGM = isOwner || isGM;

      // ===== A) Visible conflict =====
      const { data: existingMgr } = await admin
        .from("barberos")
        .select("id, nombre, apellido, roles_equipo, rol_equipo")
        .eq("organization_id", organizationId)
        .eq("sucursal_id", finalSucursalId)
        .eq("activo", true)
        .neq("id", barberoId);
      const visibleConflict = (existingMgr || []).find((m: any) =>
        (Array.isArray(m.roles_equipo) && m.roles_equipo.includes("manager")) ||
        m.rol_equipo === "manager"
      );
      if (visibleConflict) {
        if (!replaceExistingManager) {
          return jsonResponse(200, {
            ok: false,
            code: "MANAGER_REPLACE_REQUIRED",
            currentManagerBarberoId: visibleConflict.id,
            currentManagerName: `${visibleConflict.nombre} ${visibleConflict.apellido}`.trim(),
            sucursalId: finalSucursalId,
            error: `La sucursal ya tiene un Encargado activo (${visibleConflict.nombre} ${visibleConflict.apellido}).`,
          });
        }
        if (!callerIsOwnerOrGM) {
          return jsonResponse(403, { error: "Solo el dueño o encargado general pueden reemplazar a un Encargado existente" });
        }
        if (existingManagerBarberoId && existingManagerBarberoId !== visibleConflict.id) {
          return jsonResponse(409, { error: "El Encargado actual cambió. Reintentá la operación." });
        }
        // Demote previous manager
        const prevRolesEquipo: string[] = Array.isArray(visibleConflict.roles_equipo) ? visibleConflict.roles_equipo : [];
        const hadBarber = prevRolesEquipo.includes("barber") || (visibleConflict.rol_equipo === "barbero");
        const newPrevRoles: AppRole[] = hadBarber ? ["barber"] : ["otros"];
        const newPrevRolEquipo: RolEquipo = hadBarber ? "barbero" : "otros";
        const { error: demoteErr } = await admin
          .from("barberos")
          .update({ roles_equipo: newPrevRoles, rol_equipo: newPrevRolEquipo })
          .eq("id", visibleConflict.id)
          .eq("organization_id", organizationId);
        if (demoteErr) return jsonResponse(500, { error: `No se pudo degradar al Encargado anterior: ${demoteErr.message}` });

        // Sync prev manager's user_roles (remove 'manager', preserve others, ensure barber if applicable)
        const { data: prevProfile } = await admin
          .from("profiles").select("id").eq("barbero_id", visibleConflict.id).maybeSingle();
        if (prevProfile?.id) {
          await admin.from("user_roles").delete().eq("user_id", prevProfile.id).eq("role", "manager");
          if (hadBarber) {
            const { data: hasBarber } = await admin.from("user_roles")
              .select("user_id").eq("user_id", prevProfile.id).eq("role", "barber").maybeSingle();
            if (!hasBarber) {
              await admin.from("user_roles").insert({ user_id: prevProfile.id, role: "barber" });
            }
          }
        }
      } else {
        // ===== B) Stale conflict =====
        const { data: managersWithRole } = await admin
          .from("user_roles").select("user_id").eq("role", "manager");
        const candidateUserIds = (managersWithRole || []).map((r: any) => r.user_id);
        if (candidateUserIds.length > 0) {
          const { data: candidateProfiles } = await admin
            .from("profiles")
            .select("id, barbero_id, organization_id, email, full_name")
            .in("id", candidateUserIds)
            .eq("organization_id", organizationId);
          const candidates = (candidateProfiles || []).filter((p: any) => p.barbero_id !== barberoId);
          if (candidates.length > 0) {
            const orgUserIds = candidates.map((p: any) => p.id);
            const { data: branchAssign } = await admin
              .from("user_sucursales")
              .select("user_id")
              .in("user_id", orgUserIds)
              .eq("sucursal_id", finalSucursalId);
            const staleUserIds = (branchAssign || []).map((b: any) => b.user_id);
            if (staleUserIds.length > 0) {
              const stale = candidates.find((p: any) => staleUserIds.includes(p.id));
              if (!resolveStaleManagerConflict) {
                return jsonResponse(200, {
                  ok: false,
                  code: "STALE_MANAGER_ROLE",
                  conflictType: "stale_user_role",
                  conflictUserId: stale?.id ?? null,
                  conflictBarberoId: stale?.barbero_id ?? null,
                  conflictEmail: stale?.email ?? null,
                  conflictName: stale?.full_name ?? null,
                  sucursalId: finalSucursalId,
                  error: "Hay una inconsistencia: este usuario figura como Encargado en permisos reales, pero no aparece como Encargado en la ficha del equipo.",
                });
              }
              if (!callerIsOwnerOrGM) {
                return jsonResponse(403, { error: "Solo el dueño o encargado general pueden corregir esta inconsistencia" });
              }
              // Remove only 'manager' role from stale users in this branch
              await admin.from("user_roles").delete().in("user_id", staleUserIds).eq("role", "manager");
            }
          }
        }
      }
    }

    // Email validation
    let emailToPersist: string | null | undefined = accessEmail;
    if (typeof accessEmail === "string") {
      if (accessEmail.trim() === "") {
        emailToPersist = null;
      } else {
        const e = accessEmail.trim().toLowerCase();
        if (!isEmail(e)) return jsonResponse(400, { error: "Email inválido" });
        emailToPersist = e;
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

    const finalRolEquipo: RolEquipo = normalizedRoles
      ? rolesToRolEquipo(normalizedRoles)
      : (barbero.rol_equipo as RolEquipo);

    if (regenerateAccess) {
      const finalEmail = (typeof emailToPersist === "string" ? emailToPersist : barbero.access_email);
      if (!finalEmail) return jsonResponse(400, { error: "Falta email para generar acceso" });
      if (finalRolEquipo === "otros") return jsonResponse(400, { error: "El cargo 'Otros' no permite acceso al sistema" });
    }

    // ===== MUTATIONS =====
    const updates: any = {};
    if (emailToPersist !== undefined) updates.access_email = emailToPersist;
    if (normalizedRoles) {
      updates.rol_equipo = finalRolEquipo;
      updates.roles_equipo = normalizedRoles;
    }
    if (sucursalId !== undefined) updates.sucursal_id = sucursalId;

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await admin
        .from("barberos").update(updates)
        .eq("id", barberoId)
        .eq("organization_id", organizationId);
      if (updErr) return jsonResponse(400, { error: `No se pudo actualizar miembro: ${updErr.message}` });
      // Verify post-update integrity
      const { data: verify, error: vErr } = await admin
        .from("barberos")
        .select("id, organization_id, rol_equipo, roles_equipo")
        .eq("id", barberoId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (vErr || !verify) return jsonResponse(404, { error: "No se pudo verificar el miembro tras actualizar" });
      if (normalizedRoles && verify.rol_equipo !== finalRolEquipo) {
        return jsonResponse(500, { error: "El cargo no quedó persistido. Reintentá." });
      }
    }

    let tempPassword: string | null = null;
    let resultUserId: string | null = targetUserId;

    if (regenerateAccess) {
      const finalEmail = (typeof emailToPersist === "string" ? emailToPersist : barbero.access_email)!;
      tempPassword = generatePassword();
      const fullName = `${barbero.nombre} ${barbero.apellido}`.trim();

      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users?.find(u => u.email?.toLowerCase() === finalEmail.toLowerCase());

      // Fase 7: if email exists and belongs to a DIFFERENT user, reject
      if (existing && existing.id !== targetUserId) {
        const conflict = await checkEmailConflict(admin, finalEmail, targetUserId, organizationId);
        if (conflict) return jsonResponse(conflict.status, conflict.body);
      }


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
      if (pErr) return jsonResponse(500, { error: `Perfil: ${pErr.message}.` });

      // Sync user_roles with multi-role array (filter 'otros' — not stored as a real role)
      const rolesForAuth = (normalizedRoles ?? rolEquipoToRoles(finalRolEquipo)).filter(r => r !== "otros");
      await admin.from("user_roles").delete().eq("user_id", resultUserId!);
      if (rolesForAuth.length > 0) {
        const rows = rolesForAuth.map(role => ({ user_id: resultUserId!, role }));
        const { error: rErr } = await admin.from("user_roles").insert(rows);
        if (rErr) return jsonResponse(500, { error: `Cargo: ${rErr.message}.` });
      }

      if (finalSucursalId && rolesForAuth.some(r => r === "manager" || r === "barber")) {
        await admin.from("user_sucursales").delete().eq("user_id", resultUserId!);
        await admin.from("user_sucursales").insert({
          user_id: resultUserId!,
          sucursal_id: finalSucursalId,
          organization_id: organizationId,
        });
      }
    } else if (targetUserId && (normalizedRoles || emailToPersist !== undefined || sucursalId !== undefined)) {
      const fullName = `${barbero.nombre} ${barbero.apellido}`.trim();

      if (typeof emailToPersist === "string" && emailToPersist && emailToPersist !== linkedProfile?.email?.toLowerCase()) {
        const { error: eErr } = await admin.auth.admin.updateUserById(targetUserId, { email: emailToPersist, email_confirm: true });
        if (eErr) return jsonResponse(500, { error: `Auth email: ${eErr.message}` });
        await admin.from("profiles").update({ email: emailToPersist, full_name: fullName }).eq("id", targetUserId);
      }

      if (normalizedRoles) {
        // Preserve owner — already validated above
        const rolesForAuth = normalizedRoles.filter(r => r !== "otros");
        await admin.from("user_roles").delete().eq("user_id", targetUserId);
        if (rolesForAuth.length > 0) {
          const rows = rolesForAuth.map(role => ({ user_id: targetUserId, role }));
          await admin.from("user_roles").insert(rows);
        }
      }

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
      roles: normalizedRoles ?? null,
      rolEquipo: finalRolEquipo,
    });
  } catch (e: any) {
    console.error("update-team-member-access error:", e);
    return jsonResponse(500, { error: e?.message ?? "Error interno" });
  }
});
