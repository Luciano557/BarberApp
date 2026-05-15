import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTareas, type Tarea } from '@/hooks/useTareas';
import { getTareaVencimiento, getPeticionVencimiento } from '@/lib/tareasVencimiento';
import { parseISO, startOfDay, addDays } from 'date-fns';
import { getEventDef, resolveNotificationEventType } from '@/lib/notifications/catalog';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

export type NotificationType =
  | 'tarea_pendiente'
  | 'tarea_vencida'
  | 'peticion_vencida';

interface DeliveryRow {
  id: string;                       // notification_deliveries.id
  notification_id: string;
  organization_id: string;
  user_id: string;
  read_at: string | null;
  hidden_at: string | null;
  created_at: string;
  notifications: {
    id: string;
    organization_id: string;
    event_key: string;
    type: NotificationType | string;
    source_module: string;
    source_table: string | null;
    source_id: string | null;
    title: string;
    body: string | null;
    notification_at: string;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
}

export interface NotificationItem {
  id: string;                  // notification_deliveries.id (UUID)
  notification_id: string;     // notifications.id
  source_type: NotificationType | string;
  source_id: string;           // tarea/peticion id
  titulo: string;
  fecha: string;               // notification_at ISO
  read: boolean;
  source_module: string;
  tarea?: Tarea;
}

interface Candidate {
  event_key: string;
  type: NotificationType;
  source_module: string;
  source_table: string;
  source_id: string;
  title: string;
  notification_at: string;
  metadata: Record<string, unknown>;
}

function toIsoFromYmd(ymd: string): string {
  // Local midnight ISO for a YYYY-MM-DD string
  return startOfDay(parseISO(ymd)).toISOString();
}

export function useNotifications() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { tareas } = useTareas();
  const { preferences } = useNotificationPreferences();
  const queryClient = useQueryClient();

  const tareasDias = organization?.tareas_vencimiento_dias_default ?? 1;
  const peticionesDias = organization?.peticiones_vencimiento_dias ?? 60;

  // 1. Candidatos calculados desde tareas/peticiones visibles
  const candidates: Candidate[] = useMemo(() => {
    if (!tareas?.length || !organization?.id) return [];
    const today = startOfDay(new Date());
    const out: Candidate[] = [];

    for (const t of tareas) {
      if (t.tipo === 'tarea' && t.estado !== 'completada') {
        const venc = getTareaVencimiento(t, tareasDias);

        // tarea_pendiente: estado pendiente y fecha_inicio <= hoy
        if (
          t.estado === 'pendiente' &&
          t.fecha_inicio &&
          startOfDay(parseISO(t.fecha_inicio)).getTime() <= today.getTime()
        ) {
          out.push({
            event_key: `tarea:${t.id}:pendiente`,
            type: 'tarea_pendiente',
            source_module: 'tareas',
            source_table: 'tareas',
            source_id: t.id,
            title: t.titulo,
            notification_at: toIsoFromYmd(t.fecha_inicio),
            metadata: {},
          });
        }

        // tarea_vencida: helper marca vencida
        if (venc.vencida && t.fecha_inicio) {
          const vencDate = addDays(startOfDay(parseISO(t.fecha_inicio)), Math.max(0, tareasDias) + 1);
          out.push({
            event_key: `tarea:${t.id}:vencida`,
            type: 'tarea_vencida',
            source_module: 'tareas',
            source_table: 'tareas',
            source_id: t.id,
            title: t.titulo,
            notification_at: vencDate.toISOString(),
            metadata: {},
          });
        }
      } else if (t.tipo === 'peticion' && t.estado === 'pendiente') {
        const venc = getPeticionVencimiento(t, peticionesDias);
        if (venc.vencida && t.created_at) {
          const dias = t.vencimiento_dias ?? peticionesDias ?? 60;
          const vencDate = addDays(startOfDay(parseISO(t.created_at)), dias + 1);
          out.push({
            event_key: `peticion:${t.id}:vencida`,
            type: 'peticion_vencida',
            source_module: 'tareas',
            source_table: 'tareas',
            source_id: t.id,
            title: t.titulo,
            notification_at: vencDate.toISOString(),
            metadata: {},
          });
        }
      }
    }
    return out;
  }, [tareas, tareasDias, peticionesDias, organization?.id]);

  // 2. Persistir candidatos vía RPC (idempotente). Solo cuando cambia la fingerprint.
  const candidatesFingerprint = useMemo(
    () => candidates.map(c => `${c.event_key}|${c.title}`).join('||'),
    [candidates],
  );

  useEffect(() => {
    if (!organization?.id || !user?.id || candidates.length === 0) return;
    let cancelled = false;
    // Defer to next tick so we don't invalidate queries during the same
    // commit phase that mounted observers (avoids React Query queue corruption).
    const handle = setTimeout(() => {
      (async () => {
        try {
          // Filtra candidatos cuyo evento esté no-implementado o desactivado por
          // preferencia del usuario, para no crear deliveries innecesarias.
          const filtered = candidates.filter(c => {
            const canon = resolveNotificationEventType(c.type) ?? c.type;
            const def = getEventDef(canon);
            if (!def) return true; // tipo desconocido: comportamiento legacy
            if (!def.implemented) return false;
            const pref = preferences.get(def.eventType);
            const enabled = pref ?? def.defaultEnabled;
            return enabled;
          });
          await Promise.all(
            filtered.map(c =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (supabase as any).rpc('upsert_notification', {
                _organization_id: organization.id,
                _event_key: c.event_key,
                _type: c.type,
                _source_module: c.source_module,
                _source_table: c.source_table,
                _source_id: c.source_id,
                _title: c.title,
                _body: null,
                _notification_at: c.notification_at,
                _metadata: c.metadata,
              }),
            ),
          );
        } catch (e) {
          console.warn('[notifications] upsert error', e);
        }
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ['notification_deliveries'] });
        }
      })().catch(e => console.warn('[notifications] upsert batch error', e));
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatesFingerprint, organization?.id, user?.id]);

  // 3. Query principal: deliveries del usuario actual + notificacion embebida
  const { data: deliveries = [] } = useQuery({
    queryKey: ['notification_deliveries', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return [] as DeliveryRow[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_deliveries')
        .select('id, notification_id, organization_id, user_id, read_at, hidden_at, created_at, notifications!inner(*)')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .is('hidden_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      // Reorder by notification_at desc client-side (preserves historical order)
      const rows = (data ?? []) as DeliveryRow[];
      rows.sort(
        (a, b) =>
          new Date(b.notifications?.notification_at ?? b.created_at).getTime() -
          new Date(a.notifications?.notification_at ?? a.created_at).getTime(),
      );
      return rows;
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // 4. Compatibilidad: lecturas legacy (notification_reads) por (source_type, source_id)
  // notification_reads.source_type guarda el mismo string que notifications.type.
  const { data: legacyReads = [] } = useQuery({
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

  const legacyReadsBySourceKey = useMemo(() => {
    const s = new Set<string>();
    for (const r of legacyReads as Array<{ source_type: string; source_id: string }>) {
      s.add(`${r.source_type}:${r.source_id}`);
    }
    return s;
  }, [legacyReads]);

  // 5. Filtrar fuentes activas (tareas/peticiones aún visibles y vigentes)
  const tareasById = useMemo(() => {
    const m = new Map<string, Tarea>();
    for (const t of tareas ?? []) m.set(t.id, t);
    return m;
  }, [tareas]);

  const notifications: NotificationItem[] = useMemo(() => {
    const out: NotificationItem[] = [];
    for (const d of deliveries) {
      const n = d.notifications;
      if (!n) continue;

      // Filtro por catálogo + preferencia del usuario.
      // - Evento `implemented = false` → ocultar.
      // - Preferencia desactivada → ocultar.
      // - Tipo desconocido (no en catálogo) → mostrar (compatibilidad).
      const canon = resolveNotificationEventType(n.type) ?? n.type;
      const def = getEventDef(canon);
      if (def) {
        if (!def.implemented) continue;
        const pref = preferences.get(def.eventType);
        const enabled = pref ?? def.defaultEnabled;
        if (!enabled) continue;
      }

      // Filtrado activo: por ahora solo modulo tareas
      if (n.source_module === 'tareas' && n.source_id) {
        const t = tareasById.get(n.source_id);
        if (!t) continue; // no visible para el usuario o eliminada
        if (t.estado === 'completada') continue;
        if (t.tipo === 'peticion' && t.estado !== 'pendiente') continue;
      }
      const read =
        !!d.read_at ||
        (n.source_id && legacyReadsBySourceKey.has(`${n.type}:${n.source_id}`)) ||
        false;

      out.push({
        id: d.id,
        notification_id: n.id,
        source_type: n.type,
        source_id: n.source_id ?? '',
        titulo: n.title,
        fecha: n.notification_at,
        read: !!read,
        source_module: n.source_module,
        tarea: n.source_id ? tareasById.get(n.source_id) : undefined,
      });
    }
    return out;
  }, [deliveries, tareasById, legacyReadsBySourceKey, preferences]);

  const unreadNotifications = useMemo(
    () => notifications.filter(n => !n.read),
    [notifications],
  );
  const readNotifications = useMemo(
    () => notifications.filter(n => n.read),
    [notifications],
  );
  const unreadCount = unreadNotifications.length;

  // 6. Mutations — operan sobre notification_deliveries (id = delivery.id)
  const markAsRead = useMutation({
    mutationFn: async (item: Pick<NotificationItem, 'id' | 'source_type' | 'source_id'>) => {
      if (!user?.id || !organization?.id) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notification_deliveries')
        .update({ read_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onError: (e) => console.warn('[notifications] markAsRead error', e),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_deliveries'] });
    },
  });

  const markAsUnread = useMutation({
    mutationFn: async (item: Pick<NotificationItem, 'id' | 'source_type' | 'source_id'>) => {
      if (!user?.id || !organization?.id) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notification_deliveries')
        .update({ read_at: null })
        .eq('id', item.id)
        .eq('user_id', user.id);
      if (error) throw error;
      // Compat: también limpiar lectura legacy si existiera
      if (item.source_type && item.source_id) {
        await supabase
          .from('notification_reads')
          .delete()
          .eq('user_id', user.id)
          .eq('organization_id', organization.id)
          .eq('source_type', item.source_type)
          .eq('source_id', item.source_id);
      }
    },
    onError: (e) => console.warn('[notifications] markAsUnread error', e),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['notification_reads'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id || !organization?.id) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notification_deliveries')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .is('read_at', null)
        .is('hidden_at', null);
      if (error) throw error;
    },
    onError: (e) => console.warn('[notifications] markAllAsRead error', e),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_deliveries'] });
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['notification_deliveries'] });
    queryClient.invalidateQueries({ queryKey: ['notification_reads'] });
    queryClient.invalidateQueries({ queryKey: ['tareas'] });
  };

  return {
    notifications,
    unreadNotifications,
    readNotifications,
    unreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    refresh,
  };
}
