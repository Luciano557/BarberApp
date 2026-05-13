import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + (Deno.env.get("PIN_SALT") || "barbershop_salt_2024"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const ALLOWED_ROLES_FOR_ACTIONS = new Set(['owner', 'general_manager', 'manager']);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { pin, sucursal_id, action_key } = await req.json();

    if (!pin) {
      return new Response(
        JSON.stringify({ error: 'PIN requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pinHash = await hashPin(pin);

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('organization_id, full_name, email')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(
        JSON.stringify({ valid: false, error: 'No se encontró la organización' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: barberos, error: barberoError } = await serviceClient
      .from('barberos')
      .select('id, nombre, apellido, sucursal_id')
      .eq('organization_id', profile.organization_id)
      .eq('pin_hash', pinHash)
      .eq('activo', true)
      .limit(1);
    if (barberoError) throw barberoError;
    const barbero = barberos && barberos.length > 0 ? barberos[0] : null;

    if (!barbero) {
      return new Response(
        JSON.stringify({ valid: false, error: 'PIN incorrecto' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const barberoName = `${barbero.nombre} ${barbero.apellido}`;

    // Resolve linked profile + roles
    const { data: linkedProfiles } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('barbero_id', barbero.id)
      .limit(1);
    const linkedProfile = linkedProfiles && linkedProfiles.length > 0 ? linkedProfiles[0] : null;

    let roles: string[] = [];
    if (linkedProfile) {
      const { data: rolesData } = await serviceClient
        .from('user_roles')
        .select('role')
        .eq('user_id', linkedProfile.id);
      roles = (rolesData || []).map((r: any) => r.role);
    }

    const isOwner = roles.includes('owner');
    const isGeneralManager = roles.includes('general_manager');
    const isManager = roles.includes('manager');

    // ===== STRICT MODE: action_key present =====
    if (action_key) {
      // Only owner/general_manager/manager are allowed to authorize sensitive actions.
      // sucursal_account, barber and any other role are rejected.
      const allowedRole = roles.find(r => ALLOWED_ROLES_FOR_ACTIONS.has(r));
      if (!allowedRole) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Este PIN no tiene permisos para autorizar esta acción',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Manager: limitado a sus sucursales asignadas en user_sucursales
      if (allowedRole === 'manager' && !isOwner && !isGeneralManager) {
        if (!sucursal_id) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Sucursal requerida para autorizar' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (!linkedProfile) {
          return new Response(
            JSON.stringify({ valid: false, error: 'PIN no autorizado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const { data: us } = await serviceClient
          .from('user_sucursales')
          .select('sucursal_id')
          .eq('user_id', linkedProfile.id)
          .eq('sucursal_id', sucursal_id)
          .limit(1);
        if (!us || us.length === 0) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Manager no autorizado en esta sucursal' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const validatedByRole = isOwner
        ? 'owner'
        : isGeneralManager
        ? 'general_manager'
        : 'manager';

      // Audit log
      await serviceClient.from('access_logs').insert({
        user_id: user.id,
        user_email: user.email || profile.email || '',
        user_name: barberoName,
        section: `action:${action_key}`,
        organization_id: profile.organization_id,
      });

      return new Response(
        JSON.stringify({
          valid: true,
          userName: barberoName,
          user_name: barberoName,
          validatedByUserId: linkedProfile?.id ?? null,
          validatedByRole,
          barbero_id: barbero.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== LEGACY MODE: no action_key (back-compat) =====
    const hasGlobalRole = isOwner || isGeneralManager;

    if (!hasGlobalRole && sucursal_id && barbero.sucursal_id !== sucursal_id) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Este PIN no tiene acceso a esta sucursal',
          barbero_sucursal_id: barbero.sucursal_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await serviceClient.from('access_logs').insert({
      user_id: user.id,
      user_email: user.email || profile.email || '',
      user_name: barberoName,
      section: 'protected',
      organization_id: profile.organization_id,
    });

    return new Response(
      JSON.stringify({
        valid: true,
        user_name: barberoName,
        barbero_id: barbero.id,
        barbero_sucursal_id: barbero.sucursal_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
