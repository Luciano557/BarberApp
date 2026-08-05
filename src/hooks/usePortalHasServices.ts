import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Replica la regla de "reservable" de supabase/functions/get-org-public
 * (servicio activo, con precio, en una sucursal activa no eliminada) para
 * saber si la vista previa del portal debe mostrar el botón de reservar o
 * el aviso de "sin servicios". No trae filas — solo cuenta coincidencias.
 */
export function usePortalHasServices(orgId: string | undefined): boolean {
  // Arranca en true para no destellar el aviso de "sin servicios" en cada
  // carga mientras la query todavía no resolvió.
  const [hasServices, setHasServices] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    const check = async () => {
      const { count, error } = await supabase
        .from('servicios_sucursales')
        .select('id, sucursales!inner(activa,deleted_at), servicios!inner(eliminado)', {
          count: 'exact',
          head: true,
        })
        .eq('organization_id', orgId)
        .eq('activo', true)
        .gt('precio', 0)
        .not('sucursal_id', 'is', null)
        .eq('sucursales.activa', true)
        .is('sucursales.deleted_at', null)
        .or('eliminado.is.null,eliminado.eq.false', { foreignTable: 'servicios' })
        .limit(1);

      if (cancelled || error) return;
      setHasServices((count ?? 0) > 0);
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return hasServices;
}
