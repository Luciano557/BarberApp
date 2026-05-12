import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SucursalAccountRow {
  id: string;
  email: string;
  estado: string;
  temp_password_pending: boolean;
  last_password_reset_at: string | null;
  sucursal_id: string;
  organization_id: string;
}

export function useSucursalAccount(sucursalId: string | null | undefined) {
  const [account, setAccount] = useState<SucursalAccountRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccount = useCallback(async () => {
    if (!sucursalId) { setAccount(null); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sucursal_accounts')
        .select('id, email, estado, temp_password_pending, last_password_reset_at, sucursal_id, organization_id')
        .eq('sucursal_id', sucursalId)
        .maybeSingle();
      if (error) throw error;
      setAccount(data as SucursalAccountRow | null);
    } catch (e) {
      console.error('useSucursalAccount fetch', e);
      setAccount(null);
    } finally {
      setIsLoading(false);
    }
  }, [sucursalId]);

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  return { account, isLoading, refetch: fetchAccount };
}
