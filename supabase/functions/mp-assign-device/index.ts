/**
 * mp-assign-device
 *
 * Assigns (or unassigns) a MP Point terminal to a sucursal.
 * Only owners and general managers can perform this action.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/mp-client.ts';

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.organization_id) {
    return jsonResponse({ error: 'No organization' }, 400);
  }

  // Verify caller is owner or general_manager
  const { data: roles } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const allowedRoles = ['owner', 'general_manager'];
  const hasPermission = roles?.some((r: { role: string }) => allowedRoles.includes(r.role));
  if (!hasPermission) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  try {
    const { device_id, sucursal_id } = await req.json() as {
      device_id: string;
      sucursal_id: string | null;
    };

    if (!device_id) {
      return jsonResponse({ error: 'device_id es requerido' }, 400);
    }

    const { error: updateError } = await supabaseAdmin
      .from('mp_devices')
      .update({
        sucursal_id: sucursal_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('mp_device_id', device_id)
      .eq('organization_id', profile.organization_id);

    if (updateError) {
      console.error('[mp-assign-device] update error:', updateError);
      return jsonResponse({ error: 'Error al asignar terminal' }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[mp-assign-device] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
