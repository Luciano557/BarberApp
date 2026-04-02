import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function for PIN (using Web Crypto API)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + (Deno.env.get("PIN_SALT") || "barbershop_salt_2024"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

    const { barbero_id, pin, action, currentPin } = await req.json();

    // Use service role to update barbero PIN
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Determine which barbero_id to use
    let targetBarberoId = barbero_id;

    // If no barbero_id provided, use the user's own barbero_id from profile
    if (!targetBarberoId) {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('barbero_id')
        .eq('id', user.id)
        .single();

      if (profile?.barbero_id) {
        targetBarberoId = profile.barbero_id;
      }
    }

    if (!targetBarberoId) {
      return new Response(
        JSON.stringify({ error: 'No se encontró un barbero vinculado a tu cuenta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security check: if barbero_id was explicitly provided and differs from user's own,
    // verify user is owner or general_manager
    if (barbero_id) {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('barbero_id')
        .eq('id', user.id)
        .single();

      if (profile?.barbero_id !== barbero_id) {
        const { data: roles } = await serviceClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['owner', 'general_manager']);

        if (!roles || roles.length === 0) {
          return new Response(
            JSON.stringify({ error: 'No tienes permiso para configurar el PIN de otro usuario' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Check if barbero already has a PIN
    const { data: barbero, error: fetchError } = await serviceClient
      .from('barberos')
      .select('pin_hash')
      .eq('id', targetBarberoId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // If barbero has an existing PIN and this is not a delete, verify currentPin
    if (barbero?.pin_hash && action !== 'delete') {
      if (!currentPin) {
        return new Response(
          JSON.stringify({ error: 'Debes ingresar el PIN actual' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const currentPinHash = await hashPin(currentPin);
      if (currentPinHash !== barbero.pin_hash) {
        return new Response(
          JSON.stringify({ error: 'El PIN actual es incorrecto' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'delete') {
      // Also verify current PIN before deleting
      if (barbero?.pin_hash) {
        if (!currentPin) {
          return new Response(
            JSON.stringify({ error: 'Debes ingresar el PIN actual para eliminarlo' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const currentPinHash = await hashPin(currentPin);
        if (currentPinHash !== barbero.pin_hash) {
          return new Response(
            JSON.stringify({ error: 'El PIN actual es incorrecto' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { error: updateError } = await serviceClient
        .from('barberos')
        .update({ pin_hash: null })
        .eq('id', targetBarberoId);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'PIN eliminado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate PIN format (4-6 digits)
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: 'El PIN debe tener entre 4 y 6 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pinHash = await hashPin(pin);

    // Update barbero PIN
    const { error: updateError } = await serviceClient
      .from('barberos')
      .update({ pin_hash: pinHash })
      .eq('id', targetBarberoId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'PIN configurado correctamente' }),
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
