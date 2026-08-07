import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Suscripción Realtime a `turnos` para una sucursal.
 *
 * - INSERT / UPDATE / DELETE filtrados por `sucursal_id` (posible en DELETE
 *   porque la tabla tiene REPLICA IDENTITY FULL).
 * - Un único callback `onChange` con debounce (~300ms) para evitar ráfagas.
 * - La RLS de `turnos` sigue siendo la barrera real: el filtro del canal es
 *   solo una optimización.
 */
export function useTurnosRealtime(params: {
  sucursalId: string | null | undefined;
  onChange: () => void;
  enabled?: boolean;
}) {
  const { sucursalId, onChange, enabled = true } = params;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || !sucursalId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onChangeRef.current();
      }, 300);
    };

    const filter = `sucursal_id=eq.${sucursalId}`;
    const channelName = `turnos:${sucursalId}:${Math.random().toString(36).slice(2, 8)}`;

    const ch = supabase
      .channel(channelName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'turnos', filter }, trigger)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'turnos', filter }, trigger)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any,
        { event: 'DELETE', schema: 'public', table: 'turnos', filter }, trigger)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(ch);
    };
  }, [sucursalId, enabled]);
}
