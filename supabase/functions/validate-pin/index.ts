import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Same hash function as set-pin
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

    const { pin } = await req.json();

    if (!pin) {
      return new Response(
        JSON.stringify({ error: 'PIN requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pinHash = await hashPin(pin);

    // Get user's profile to get organization_id
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

    // Use service role to check barbero PINs in the organization
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find barbero with matching PIN in the same organization
    const { data: barbero, error: barberoError } = await serviceClient
      .from('barberos')
      .select('id, nombre, apellido')
      .eq('organization_id', profile.organization_id)
      .eq('pin_hash', pinHash)
      .eq('activo', true)
      .maybeSingle();

    if (barberoError) {
      throw barberoError;
    }

    if (barbero) {
      const barberoName = `${barbero.nombre} ${barbero.apellido}`;
      
      // Log access
      await serviceClient.from('access_logs').insert({
        user_id: user.id,
        user_email: user.email || profile.email || '',
        user_name: barberoName,
        section: 'protected',
        organization_id: profile.organization_id
      });

      return new Response(
        JSON.stringify({ 
          valid: true, 
          user_name: barberoName,
          barbero_id: barbero.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PIN doesn't match any barbero
    return new Response(
      JSON.stringify({ valid: false, error: 'PIN incorrecto' }),
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
