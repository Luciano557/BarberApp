import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTareas, type Tarea } from '@/hooks/useTareas';
import { getTareaVencimiento, getPeticionVencimiento } from '@/lib/tareasVencimiento';
import { parseISO, startOfDay } from 'date-fns';

export type NotificationType =
  | 'tarea_pendiente'
  | 'tarea_vencida'
  | 'peticion_vencida';

export interface NotificationItem {
  id: string;            // composite key for UI
  source_type: NotificationType;
  source_id: string;     // tarea.id
  titulo: string;
  fecha: string | null;  // YYYY-MM-DD reference
  read: boolean;
  tarea: Tarea;
}

export function useNotifications() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { tareas } = useTareas();
  const queryClient = useQueryClient();

  const tareasDias = organization?.tareas_vencimiento_dias_default ?? 1;
  const peticionesDias = organization?.peticiones_vencimiento_dias ?? 60;

  const candidates: Omit<NotificationItem, 'read'>[] = useMemo(() => {
    if (!tareas?.length) return [];
    const today = startOfDay(new Date());
    const out: Omit<NotificationItem, 'read'>[] = [];

    for (const t of tareas) {
      if (t.tipo === 'tarea' && t.estado !== 'completada') {
        const venc = getTareaVencimiento(t, tareasDias);
        if (venc.vencida) {
          out.push({
            id: `tarea_vencida:${t.id}`,
            source_type: 'tarea_vencida',
            source_id: t.id,
            titulo: t.titulo,
            fecha: t.fecha_inicio,
            tarea: t,
          });
          continue;
        }
        if (
          t.estado === 'pendiente' &&
          t.fecha_inicio &&
          startOfDay(parseISO(t.fecha_inicio)).getTime() <= today.getTime()
        ) {
          out.push({
            id: `tarea_pendiente:${t.id}`,
            source_type: 'tarea_pendiente',
            source_id: t.id,
            titulo: t.titulo,
            fecha: t.fecha_inicio,
            tarea: t,
          });
        }
      } else if (t.tipo === 'peticion' && t.estado === 'pendiente') {
        const venc = getPeticionVencimiento(t, peticionesDias);
        if (venc.vencida) {
          out.push({
            id: `peticion_vencida:${t.id}`,
            source_type: 'peticion_vencida',
            source_id: t.id,
            titulo: t.titulo,
            fecha: t.created_at?.slice(0, 10) ?? null,
            tarea: t,
          });
        }
      }
    }
    return out;
  }, [tareas, tareasDias, peticionesDias]);

  // Fetch reads
  const { data: reads = [] } = useQuery({
    queryKey: ['notification_reads', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return [];
      const { data, error } = await supabase
        .from('notification_reads')
        .select('source_type, source_id')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!organization?.id,
  });

  const readSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of reads) s.add(`${r.source_type}:${r.source_id}`);
    return s;
  }, [reads]);

  const notifications: NotificationItem[] = useMemo(
    () => candidates.map(c => ({ ...c, read: readSet.has(c.id) })),
    [candidates, readSet],
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useMutation({
    mutationFn: async (item: Pick<NotificationItem, 'source_type' | 'source_id'>) => {
      if (!user?.id || !organization?.id) return;
      const { error } = await supabase
        .from('notification_reads')
        .upsert(
          {
            user_id: user.id,
            organization_id: organization.id,
            source_type: item.source_type,
            source_id: item.source_id,
          },
          { onConflict: 'user_id,source_type,source_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_reads'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id || !organization?.id) return;
      const unread = notifications.filter(n => !n.read);
      if (!unread.length) return;
      const rows = unread.map(n => ({
        user_id: user.id,
        organization_id: organization.id,
        source_type: n.source_type,
        source_id: n.source_id,
      }));
      const { error } = await supabase
        .from('notification_reads')
        .upsert(rows, { onConflict: 'user_id,source_type,source_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_reads'] });
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['notification_reads'] });
    queryClient.invalidateQueries({ queryKey: ['tareas'] });
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead, refresh };
}
