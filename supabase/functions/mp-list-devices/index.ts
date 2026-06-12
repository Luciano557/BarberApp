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
import {
  getAccessToken,
  mpErrorMessage,
  mpFetch,
  readMpError,
  corsHeaders,
  jsonResponse,
} from '../_shared/mp-client.ts';

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

    // Mercado Pago Point integration API — device listing.
    // Docs: GET /point/integration-api/devices
    // Response: { devices: [{ id, operating_mode, pos_id, store_id, ... }], paging: { ... } }
    const mpRes = await mpFetch('/point/integration-api/devices', accessToken);

    if (!mpRes.ok) {
      const mpError = await readMpError(mpRes);
      console.error('[mp-list-devices] MP API error:', mpRes.status, mpError.payload);
      return jsonResponse({
        error: mpErrorMessage(mpError, mpRes.status, 'Error al obtener terminales de Mercado Pago'),
        code: mpError.code,
      }, mpRes.status >= 500 ? 502 : 422);
    }

    const mpData = await mpRes.json();
    // Response shape: { devices: [{ id, operating_mode, pos_id, store_id, ... }], paging: {...} }
    const devices: Array<{ id: string; operating_mode: string; [k: string]: unknown }> =
      mpData?.devices ?? [];

    await supabaseAdmin
      .from('mp_devices')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('organization_id', orgId);

    if (devices.length > 0) {
      const { data: existingDevices } = await supabaseAdmin
        .from('mp_devices')
        .select('mp_device_id, name, sucursal_id')
        .eq('organization_id', orgId);

      const existingNames = new Map<string, string | null>(
        (existingDevices ?? []).map((device: { mp_device_id: string; name: string | null }) => [
          device.mp_device_id,
          device.name,
        ]),
      );

      // Preserve sucursal_id already assigned by the user — only update fields we own.
      const existingSucursales = new Map<string, string | null>(
        (existingDevices ?? []).map(
          (device: { mp_device_id: string; sucursal_id: string | null }) => [
            device.mp_device_id,
            device.sucursal_id,
          ],
        ),
      );

      // Sync devices into our table (upsert, preserve sucursal_id assignment)
      const upsertRows = devices.map((d) => ({
        organization_id: orgId,
        mp_device_id: d.id,
        name: existingNames.get(d.id) ?? d.id,
        operating_mode: d.operating_mode ?? 'UNDEFINED',
        // Only PDV-mode terminals can receive programmatic payment intents via API.
        activo: d.operating_mode === 'PDV',
        // Preserve any sucursal assignment the admin has already made.
        sucursal_id: existingSucursales.get(d.id) ?? null,
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