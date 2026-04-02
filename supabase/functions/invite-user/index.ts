import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  fullName: string;
  role: "barber" | "manager" | "general_manager";
  barberoId?: string;
  organizationId: string;
  organizationName: string;
  sucursalId?: string;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requesting user is authenticated and is an owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !requestingUser) {
      throw new Error("Unauthorized");
    }

    // Check if requesting user is an owner or general_manager
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .in("role", ["owner", "general_manager"]);

    if (!adminRole || adminRole.length === 0) {
      throw new Error("Only owners and general managers can invite users");
    }

    const { email, fullName, role, barberoId, organizationId, organizationName, sucursalId }: InviteRequest = await req.json();

    // Validate input
    if (!email || !fullName || !role || !organizationId) {
      throw new Error("Missing required fields");
    }

    if (!["barber", "manager", "general_manager"].includes(role)) {
      throw new Error("Invalid role");
    }

    // Generate temporary password
    const tempPassword = generatePassword();

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    let userId: string;
    let isExistingUser = false;
    
    if (existingUser) {
      // User exists - update their password
      isExistingUser = true;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { 
          password: tempPassword,
          user_metadata: {
            ...existingUser.user_metadata,
            must_change_password: true,
          }
        }
      );
      
      if (updateError) {
        console.error("Update user error:", updateError);
        throw new Error(updateError.message || "Error actualizando usuario");
      }
      
      userId = existingUser.id;
      console.log("Password reset for existing user:", existingUser.email);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          must_change_password: true,
          invited_by: requestingUser.id,
        },
      });

      if (createError || !newUser.user) {
        console.error("Create user error:", createError);
        throw new Error(createError?.message || "Error creating user");
      }
      
      userId = newUser.user.id;
    }

    // Update profile with organization_id and barbero_id
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        organization_id: organizationId,
        barbero_id: barberoId || null,
        full_name: fullName,
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // Assign role (upsert to handle existing users)
    if (!isExistingUser) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role: role,
        });

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }
    }

    // Assign sucursal for manager role
    if (sucursalId) {
      // Check if already assigned
      const { data: existing } = await supabaseAdmin
        .from("user_sucursales")
        .select("id")
        .eq("user_id", userId)
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

      if (!existing) {
        const { error: sucursalError } = await supabaseAdmin
          .from("user_sucursales")
          .insert({
            user_id: userId,
            sucursal_id: sucursalId,
            organization_id: organizationId,
          });

        if (sucursalError) {
          console.error("Sucursal assignment error:", sucursalError);
        }
      }
    }

    // Try to send email (but don't fail if it doesn't work)
    const roleLabel = role === "barber" ? "Barbero" : role === "general_manager" ? "Encargado General" : "Encargado de Sucursal";
    
    try {
      const emailResult = await resend.emails.send({
        from: "BarberPOS <onboarding@resend.dev>",
        to: [email],
        subject: `¡Bienvenido a ${organizationName}!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 500px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
              .credentials { background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .credential-item { margin: 10px 0; }
              .label { font-size: 12px; color: #666; text-transform: uppercase; }
              .value { font-size: 18px; font-weight: 600; font-family: monospace; background: #fff; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 4px; }
              .warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 14px; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">✂️ ${organizationName}</div>
              </div>
              
              <p>Hola <strong>${fullName}</strong>,</p>
              
              <p>Has sido invitado a unirte a <strong>${organizationName}</strong> como <strong>${roleLabel}</strong>.</p>
              
              <div class="credentials">
                <div class="credential-item">
                  <div class="label">Email</div>
                  <div class="value">${email}</div>
                </div>
                <div class="credential-item">
                  <div class="label">Contraseña provisional</div>
                  <div class="value">${tempPassword}</div>
                </div>
              </div>
              
              <div class="warning">
                ⚠️ <strong>Importante:</strong> Al iniciar sesión por primera vez, se te pedirá que cambies tu contraseña por una nueva.
              </div>
              
              <p>¡Te esperamos!</p>
              
              <div class="footer">
                <p>Este email fue enviado automáticamente por BarberPOS</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
      console.log("Email sent:", emailResult);
    } catch (emailError) {
      console.log("Email sending failed (non-critical):", emailError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: userId,
        tempPassword: tempPassword,
        isExistingUser: isExistingUser,
        message: isExistingUser ? "Contraseña regenerada" : "Usuario creado correctamente"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
