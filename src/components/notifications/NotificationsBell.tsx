import { useState } from 'react';
import { Bell, ClipboardList, AlertTriangle, Inbox, CheckCheck, Check, Undo2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationsBellProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

const TYPE_META: Record<string, { label: string; icon: typeof ClipboardList; tone: string }> = {
  tarea_pendiente: { label: 'Tarea pendiente', icon: ClipboardList, tone: 'text-status-info-foreground' },
  tarea_vencida: { label: 'Tarea vencida', icon: AlertTriangle, tone: 'text-status-warning-foreground' },
  peticion_vencida: { label: 'Petición vencida', icon: AlertTriangle, tone: 'text-status-warning-foreground' },
};

export function NotificationsBell({ collapsed, onNavigate }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'unread' | 'read'>('unread');
  const isMobile = useIsMobile();
  const {
    unreadNotifications,
    readNotifications,
    unreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    refresh,
  } = useNotifications();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setTab('unread');
      refresh();
    }
  };

  const handleClickItem = (n: NotificationItem) => {
    if (!n.read) {
      markAsRead.mutate({ id: n.id, source_type: n.source_type, source_id: n.source_id });
    }
    setOpen(false);
    onNavigate?.();
  };

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const badge = unreadCount > 0 && (
    <span
      className={cn(
        'absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full',
        'bg-destructive text-destructive-foreground text-[10px] font-semibold leading-none',
      )}
    >
      {badgeLabel}
    </span>
  );

  const renderList = (items: NotificationItem[], variant: 'unread' | 'read') => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
          <Inbox className="h-6 w-6" />
          <p className="text-xs">
            {variant === 'unread' ? 'No tenés notificaciones nuevas' : 'No tenés notificaciones leídas'}
          </p>
        </div>
      );
    }
    return (
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-border">
          {items.map(n => {
            const meta = TYPE_META[n.source_type] ?? TYPE_META.tarea_pendiente;
            const Icon = meta.icon;
            const fechaTxt = n.fecha ? format(parseISO(n.fecha), 'dd MMM', { locale: es }) : null;
            const isRead = variant === 'read';
            return (
              <li key={n.id}>
                <div
                  className={cn(
                    'group w-full px-3 py-2.5 flex gap-2.5 hover:bg-accent transition-colors',
                    isRead && 'opacity-70',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleClickItem(n)}
                    className="flex-1 min-w-0 flex gap-2.5 text-left"
                  >
                    <span className={cn('mt-0.5 shrink-0', isRead ? 'text-muted-foreground' : meta.tone)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {meta.label}
                        </span>
                        {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      </div>
                      <p className={cn('text-sm truncate', isRead ? 'text-muted-foreground' : 'text-foreground')}>
                        {n.titulo}
                      </p>
                      {fechaTxt && <p className="text-xs text-muted-foreground">{fechaTxt}</p>}
                    </div>
                  </button>
                  <button
                    type="button"
                    title={isRead ? 'Marcar como no leída' : 'Marcar como leída'}
                    aria-label={isRead ? 'Marcar como no leída' : 'Marcar como leída'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isRead) {
                        markAsUnread.mutate({ id: n.id, source_type: n.source_type, source_id: n.source_id });
                      } else {
                        markAsRead.mutate({ id: n.id, source_type: n.source_type, source_id: n.source_id });
                      }
                    }}
                    className="shrink-0 self-start mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {isRead ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm animate-fade-in pointer-events-none"
          aria-hidden
        />
      )}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'w-full h-9 text-muted-foreground hover:text-foreground justify-start relative',
              collapsed && 'px-2 justify-center',
            )}
            title={collapsed ? `Notificaciones${unreadCount ? ` (${badgeLabel})` : ''}` : undefined}
          >
            <span className="relative inline-flex">
              <Bell className="h-4 w-4" />
              {badge}
            </span>
            {!collapsed && <span className="ml-2 text-xs">Notificaciones</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side={isMobile ? 'bottom' : 'right'}
          align={isMobile ? 'center' : 'end'}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            'p-0 overflow-hidden flex flex-col',
            isMobile
              ? 'w-[calc(100vw-24px)] max-w-[380px] max-h-[70vh]'
              : 'w-[340px] max-h-[460px]',
          )}
        >
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'unread' | 'read')} className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-popover sticky top-0 z-10">
              <TabsList className="h-8 p-0.5">
                <TabsTrigger value="unread" className="h-7 text-xs px-2.5">
                  No leídas{unreadCount > 0 && ` (${badgeLabel})`}
                </TabsTrigger>
                <TabsTrigger value="read" className="h-7 text-xs px-2.5">
                  Leídas
                </TabsTrigger>
              </TabsList>
              {tab === 'unread' && unreadCount > 0 && (
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

            <TabsContent value="unread" className="flex-1 min-h-0 mt-0 flex flex-col">
              {renderList(unreadNotifications, 'unread')}
            </TabsContent>
            <TabsContent value="read" className="flex-1 min-h-0 mt-0 flex flex-col">
              {renderList(readNotifications, 'read')}
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
    </>
  );
}
