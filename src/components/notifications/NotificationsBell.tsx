import { useState } from 'react';
import { Bell, ClipboardList, AlertTriangle, Inbox, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationsBellProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

const TYPE_META: Record<NotificationItem['source_type'], { label: string; icon: typeof ClipboardList; tone: string }> = {
  tarea_pendiente: { label: 'Tarea pendiente', icon: ClipboardList, tone: 'text-status-info-foreground' },
  tarea_vencida: { label: 'Tarea vencida', icon: AlertTriangle, tone: 'text-status-warning-foreground' },
  peticion_vencida: { label: 'Petición vencida', icon: AlertTriangle, tone: 'text-status-warning-foreground' },
};

export function NotificationsBell({ collapsed, onNavigate }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) refresh();
  };

  const handleClickItem = (n: NotificationItem) => {
    if (!n.read) markAsRead.mutate({ source_type: n.source_type, source_id: n.source_id });
    setOpen(false);
    onNavigate?.();
  };

  const badge = unreadCount > 0 && (
    <span
      className={cn(
        'absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full',
        'bg-destructive text-destructive-foreground text-[10px] font-semibold leading-none',
      )}
    >
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'w-full h-9 text-muted-foreground hover:text-foreground justify-start relative',
            collapsed && 'px-2 justify-center',
          )}
          title={collapsed ? `Notificaciones${unreadCount ? ` (${unreadCount})` : ''}` : undefined}
        >
          <span className="relative inline-flex">
            <Bell className="h-4 w-4" />
            {badge}
          </span>
          {!collapsed && <span className="ml-2 text-xs">Notificaciones</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        className="w-80 p-0"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Notificaciones</span>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => markAllAsRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <Inbox className="h-6 w-6" />
            <p className="text-xs">No tenés notificaciones</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px]">
            <ul className="divide-y divide-border">
              {notifications.slice(0, 20).map(n => {
                const meta = TYPE_META[n.source_type];
                const Icon = meta.icon;
                const fechaTxt = n.fecha
                  ? format(parseISO(n.fecha), 'dd MMM', { locale: es })
                  : null;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClickItem(n)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-accent transition-colors',
                        !n.read && 'bg-accent/40',
                      )}
                    >
                      <span className={cn('mt-0.5 shrink-0', meta.tone)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {meta.label}
                          </span>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-sm text-foreground truncate">{n.titulo}</p>
                        {fechaTxt && (
                          <p className="text-xs text-muted-foreground">{fechaTxt}</p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
