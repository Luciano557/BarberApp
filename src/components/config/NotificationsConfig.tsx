import { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import {
  CATEGORY_LABELS,
  getCatalogForRole,
  groupByCategory,
  type NotificationEventDef,
} from '@/lib/notifications/catalog';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { toast } from '@/hooks/use-toast';

export function NotificationsConfig() {
  const { preferences, scope, setPreference } = useNotificationPreferences();

  const grouped = useMemo(() => {
    const events = getCatalogForRole(scope);
    return groupByCategory(events);
  }, [scope]);

  const isEnabled = (def: NotificationEventDef): boolean => {
    if (!def.implemented) return false;
    const pref = preferences.get(def.eventType);
    return pref ?? def.defaultEnabled;
  };

  const handleToggle = (def: NotificationEventDef, value: boolean) => {
    setPreference.mutate(
      { eventType: def.eventType, enabled: value },
      {
        onError: (e: unknown) => {
          const msg = e instanceof Error ? e.message : 'No se pudo guardar la preferencia';
          toast({ title: 'Error', description: msg, variant: 'destructive' });
        },
      },
    );
  };

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <Bell className="h-6 w-6" />
        <p className="text-sm">No hay notificaciones disponibles para tu cargo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Activá o desactivá los avisos que querés recibir en tu Centro de Notificaciones. Los eventos
        marcados como “Se activará próximamente” aún no están conectados.
      </p>

      {grouped.map(({ category, events }) => (
        <section key={category} className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[category]}
          </h2>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {events.map(def => {
              const enabled = isEnabled(def);
              const disabled = !def.implemented || setPreference.isPending;
              return (
                <div
                  key={def.eventType}
                  className="flex items-start gap-4 p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{def.label}</p>
                      {!def.implemented && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Se activará próximamente
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={disabled}
                    onCheckedChange={value => handleToggle(def, value)}
                    aria-label={`Activar ${def.label}`}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
