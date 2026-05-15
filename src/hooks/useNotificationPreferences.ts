import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getEventDef, isEventVisibleForRole, type RoleScope } from '@/lib/notifications/catalog';

interface PreferenceRow {
  event_type: string;
  enabled: boolean;
}

/**
 * Hook de preferencias de notificación por usuario.
 *
 * Reglas:
 * - Sin fila guardada → fallback al `defaultEnabled` del catálogo.
 * - Evento `implemented = false` → siempre deshabilitado, no se permite togglear.
 * - Evento no permitido por rol → no se permite togglear.
 * - Toggle = upsert por (user_id, event_type). Sin DELETE desde cliente.
 */
export function useNotificationPreferences() {
  const { user, isOwner, isGeneralManager, isManager, isBarber, isSucursalAccount } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const scope: RoleScope = useMemo(() => {
    const roles: RoleScope['roles'] = [];
    if (isOwner) roles.push('owner');
    if (isGeneralManager) roles.push('general_manager');
    if (isManager) roles.push('manager');
    if (isBarber) roles.push('barber');
    if (isSucursalAccount) roles.push('sucursal_account');
    return { roles, isSucursalAccount, isBarber };
  }, [isOwner, isGeneralManager, isManager, isBarber, isSucursalAccount]);

  const { data: preferenceRows = [] } = useQuery({
    queryKey: ['notification_preferences', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id) return [] as PreferenceRow[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('user_notification_preferences')
        .select('event_type, enabled')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data ?? []) as PreferenceRow[];
    },
    enabled: !!user?.id && !!organization?.id,
  });

  const preferences = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of preferenceRows) m.set(r.event_type, r.enabled);
    return m;
  }, [preferenceRows]);

  const setPreference = useMutation({
    mutationFn: async ({ eventType, enabled }: { eventType: string; enabled: boolean }) => {
      if (!user?.id || !organization?.id) throw new Error('Sin sesión');
      const def = getEventDef(eventType);
      if (!def) throw new Error('Evento desconocido');
      if (!def.implemented) throw new Error('Evento no disponible');
      if (!isEventVisibleForRole(def, scope)) throw new Error('Evento no permitido para tu cargo');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('user_notification_preferences')
        .upsert(
          {
            user_id: user.id,
            organization_id: organization.id,
            event_type: eventType,
            enabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,event_type' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_preferences'] });
      queryClient.invalidateQueries({ queryKey: ['notification_deliveries'] });
    },
  });

  return {
    preferences,
    scope,
    setPreference,
  };
}
