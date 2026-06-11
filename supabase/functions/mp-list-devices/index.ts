/**
 * mp-list-devices
 *
 * Fetches the MercadoPago Point terminals associated with the organization's
 * MP account and syncs them into the `mp_devices` table.
 *
 * Returns the current list of devices for the caller's organization.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAccessToken, mpFetch, corsHeaders, jsonResponse } from '../_shared/mp-client.ts';

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

  // Authenticate the caller and resolve their organization
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

  const orgId = profile.organization_id as string;

  try {
    const accessToken = await getAccessToken(supabaseAdmin, orgId);
    if (!accessToken) {
      return jsonResponse({ error: 'MercadoPago no está conectado para esta organización' }, 404);
    }

    // Fetch devices from MP API
    const mpRes = await mpFetch('/point/integration-api/devices', accessToken);

    if (!mpRes.ok) {
      const body = await mpRes.text();
      console.error('[mp-list-devices] MP API error:', mpRes.status, body);
      return jsonResponse({ error: 'Error al obtener terminales de MercadoPago' }, 502);
    }

    const mpData = await mpRes.json();
    // MP response shape: { devices: [{ id, operating_mode, ... }] }
    const devices: Array<{ id: string; operating_mode: string; [k: string]: unknown }> =
      mpData.devices ?? [];

    if (devices.length > 0) {
      // Sync devices into our table (upsert, preserve sucursal_id assignment)
      const upsertRows = devices.map((d) => ({
        organization_id: orgId,
        mp_device_id: d.id,
        name: (d.id as string), // MP doesn't return a friendly name — use ID as default
        operating_mode: d.operating_mode ?? 'PDV',
        activo: true,
        updated_at: new Date().toISOString(),
      }));

      await supabaseAdmin
        .from('mp_devices')
        .upsert(upsertRows, { onConflict: 'organization_id,mp_device_id', ignoreDuplicates: false });
    }

    // Return current device rows (includes sucursal_id assignments)
    const { data: dbDevices } = await supabaseAdmin
      .from('mp_devices')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at');

    return jsonResponse({ devices: dbDevices ?? [] });
  } catch (err) {
    console.error('[mp-list-devices] error:', err);
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
