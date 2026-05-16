import { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import {
  CATEGORY_LABELS,
  getCatalogForRole,
  groupByCategory,
  type NotificationEventDef,
  type PrefMode,
} from '@/lib/notifications/catalog';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MODE_OPTIONS: Array<{ value: PrefMode; label: string }> = [
  { value: 'disabled', label: 'No notificar' },
  { value: 'always', label: 'Siempre' },
  { value: 'sucursal_account_only', label: 'Solo cuenta de sucursal' },
];

export function NotificationsConfig() {
  const { scope, getMode, setPreference } = useNotificationPreferences();

  const grouped = useMemo(() => {
    const events = getCatalogForRole(scope);
    return groupByCategory(events);
  }, [scope]);

  const handleToggleSimple = (def: NotificationEventDef, value: boolean) => {
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

  const handleSetMode = (def: NotificationEventDef, mode: PrefMode) => {
    setPreference.mutate(
      { eventType: def.eventType, mode },
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
        marcados como "Se activará próximamente" aún no están conectados.
      </p>

      {grouped.map(({ category, events }) => (
        <section key={category} className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[category]}
          </h2>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {events.map(def => {
              const disabled = !def.implemented || setPreference.isPending;
              const mode = getMode(def);
              return (
                <div key={def.eventType} className="p-4 space-y-3">
                  <div className="flex items-start gap-4">
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
                    {!def.supportsMode && (
                      <Switch
                        checked={mode !== 'disabled'}
                        disabled={disabled}
                        onCheckedChange={value => handleToggleSimple(def, value)}
                        aria-label={`Activar ${def.label}`}
                      />
                    )}
                  </div>
                  {def.supportsMode && (
                    <div className="flex flex-wrap gap-1 rounded-md bg-muted/50 p-1">
                      {MODE_OPTIONS.map(opt => {
                        const active = mode === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleSetMode(def, opt.value)}
                            className={cn(
                              'flex-1 min-w-[100px] rounded px-3 py-1.5 text-xs font-medium transition-colors',
                              active
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                              disabled && 'opacity-50 cursor-not-allowed',
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
