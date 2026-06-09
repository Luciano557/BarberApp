import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Suscripción Realtime a `barberos_sucursales`.
 *
 * - UPDATE: notifica al callback solo si cambió `disponible` (cuando hay old_record).
 * - INSERT / DELETE: notifica siempre.
 * - Filtra por `sucursal_id` si se pasa; sin filtro suscribe a toda la org
 *   (la RLS de la tabla limita lo que el cliente recibe).
 *
 * Cleanup automático: `removeChannel` en el `return` del `useEffect`.
 */
export function useBarberosSucursalesRealtime(params: {
  orgId: string | null | undefined;
  sucursalId: string | null | undefined;
  onChange: () => void;
}) {
  const { orgId, sucursalId, onChange } = params;

  useEffect(() => {
    if (!orgId) return;

    const filter = sucursalId ? `sucursal_id=eq.${sucursalId}` : undefined;
    const channelName = `bs:${orgId}:${sucursalId ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`;

    const ch = supabase
      .channel(channelName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'barberos_sucursales', ...(filter ? { filter } : {}) },
        (payload: RealtimePostgresChangesPayload<{ disponible?: boolean }>) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const oldD = (payload.old as any)?.disponible;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newD = (payload.new as any)?.disponible;
          if (oldD === undefined || newD === undefined || oldD !== newD) {
            onChange();
          }
        })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'barberos_sucursales', ...(filter ? { filter } : {}) },
        () => onChange())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any,
        { event: 'DELETE', schema: 'public', table: 'barberos_sucursales' },
        () => onChange())
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [orgId, sucursalId, onChange]);
}
