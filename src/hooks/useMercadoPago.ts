import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface MpConnectionStatus {
  isConnected: boolean;
  mpUserId: string | null;
  expiresAt: Date | null;
}

export interface MpDevice {
  id: string;
  organization_id: string;
  sucursal_id: string | null;
  mp_device_id: string;
  name: string | null;
  operating_mode: string | null;
  activo: boolean;
}

export function useMercadoPago() {
  const { organization } = useOrganization();

  const [connectionStatus, setConnectionStatus] = useState<MpConnectionStatus>({
    isConnected: false,
    mpUserId: null,
    expiresAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const [devices, setDevices] = useState<MpDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  // ── Connection status ────────────────────────────────────────────────────────

  const checkConnection = useCallback(async () => {
    if (!organization?.id) {
      setConnectionStatus({ isConnected: false, mpUserId: null, expiresAt: null });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await supabase.rpc('get_mp_connection_status', {
        _org_id: organization.id,
      });

      if (data && Array.isArray(data) && data.length > 0) {
        const row = data[0] as { is_connected: boolean; mp_user_id: string; expires_at: string };
        setConnectionStatus({
          isConnected: true,
          mpUserId: row.mp_user_id,
          expiresAt: new Date(row.expires_at),
        });
      } else {
        setConnectionStatus({ isConnected: false, mpUserId: null, expiresAt: null });
      }
    } catch (err) {
      console.error('[useMercadoPago] checkConnection error:', err);
      setConnectionStatus({ isConnected: false, mpUserId: null, expiresAt: null });
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // ── OAuth callback URL param handler ─────────────────────────────────────────
  // Runs once on mount to detect the ?mp_connected=true / ?mp_error=... redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mpConnected = params.get('mp_connected');
    const mpError = params.get('mp_error');

    if (mpConnected === 'true') {
      // Remove params from URL without reload
      const clean = window.location.pathname;
      window.history.replaceState({}, '', clean);
      checkConnection().then(() => {
        toast.success('MercadoPago conectado correctamente');
      });
    } else if (mpError) {
      window.history.replaceState({}, '', window.location.pathname);
      toast.error(`Error al conectar MercadoPago: ${decodeURIComponent(mpError)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Connect: redirect to MP OAuth ────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!organization?.id || !organization?.slug) {
      toast.error('Organización no cargada. Recargá la página.');
      return;
    }

    const clientId = import.meta.env.VITE_MP_CLIENT_ID as string | undefined;
    const redirectUri = import.meta.env.VITE_MP_REDIRECT_URI as string | undefined;

    if (!clientId || !redirectUri) {
      toast.error('MercadoPago no está configurado en este entorno.');
      return;
    }

    const state = btoa(`${organization.id}:${organization.slug}`);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      platform_id: 'mp',
      redirect_uri: redirectUri,
      state,
    });

    window.location.href = `https://auth.mercadopago.com/authorization?${params.toString()}`;
  }, [organization?.id, organization?.slug]);

  // ── Disconnect ────────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    if (!organization?.id) return;

    try {
      await supabase.rpc('delete_mp_connection', { _org_id: organization.id });
      setConnectionStatus({ isConnected: false, mpUserId: null, expiresAt: null });
      setDevices([]);
      toast.success('MercadoPago desconectado');
    } catch (err) {
      console.error('[useMercadoPago] disconnect error:', err);
      toast.error('No se pudo desconectar MercadoPago');
    }
  }, [organization?.id]);

  // ── Devices ───────────────────────────────────────────────────────────────────

  const syncDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mp-list-devices');
      if (error) throw error;
      const synced = (data?.devices as MpDevice[]) ?? [];
      setDevices(synced);
      return synced;
    } catch (err) {
      console.error('[useMercadoPago] syncDevices error:', err);
      toast.error('No se pudieron sincronizar las terminales de MercadoPago. Verificá tu conexión.');
      return [];
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const assignDevice = useCallback(async (mpDeviceId: string, sucursalId: string | null) => {
    try {
      const { error } = await supabase.functions.invoke('mp-assign-device', {
        body: { device_id: mpDeviceId, sucursal_id: sucursalId },
      });
      if (error) throw error;
      // Optimistically update local state
      setDevices((prev) =>
        prev.map((d) =>
          d.mp_device_id === mpDeviceId ? { ...d, sucursal_id: sucursalId } : d,
        ),
      );
      toast.success('Terminal actualizada');
    } catch (err) {
      console.error('[useMercadoPago] assignDevice error:', err);
      toast.error('No se pudo actualizar la terminal');
    }
  }, []);

  /** Returns devices assigned to a given sucursal and currently active. */
  const getDevicesForSucursal = useCallback(
    (sucursalId: string): MpDevice[] =>
      devices.filter((d) => d.sucursal_id === sucursalId && d.activo),
    [devices],
  );

  return {
    // connection
    ...connectionStatus,
    isLoading,
    connect,
    disconnect,
    refreshConnection: checkConnection,
    // devices
    devices,
    devicesLoading,
    syncDevices,
    assignDevice,
    getDevicesForSucursal,
  };
}