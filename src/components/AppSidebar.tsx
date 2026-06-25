import { useState, useEffect } from 'react';
import { CreditCard, BarChart3, Wallet, ClipboardList, CalendarClock, Users, Store, Settings, ChevronLeft, ChevronRight, Lock, Menu, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePinProtection } from '@/hooks/usePinProtection';
import { useIsMobile } from '@/hooks/use-mobile';
import { SucursalSelector } from '@/components/SucursalSelector';
import { NotificationsBell } from '@/components/notifications/NotificationsBell';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  general_manager: 'Enc. General',
  manager: 'Enc. Sucursal',
  barber: 'Barbero',
  sucursal_account: 'Cuenta de sucursal',
};

// Agrupación visual bajo "Gestión". Es solo presentación: los permisos que
// deciden qué ítems existen no cambian.
const MGMT_IDS = new Set(['mi-negocio', 'config']);

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);
  const { profile, roles, isOwner, isGeneralManager, isManager, isBarber, canManagePayments, canOperarCajaYGastos, canManageConfig, canViewConfig, canViewResumen, canViewTareas, canViewMiNegocio, canViewFinanzas, canViewTurnosAgenda, canViewClientes, signOut } = useAuth();
  const { organization } = useOrganization();
  const { access: subscriptionAccess } = useSubscriptionAccess();
  const { isUnlocked, requiresPin, lock, unlockedBy } = usePinProtection();

  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  // En mobile el drawer siempre muestra la versión completa: `collapsed` solo
  // lo desliza fuera de pantalla. El riel compacto es exclusivo de desktop.
  const railMode = !isMobile && collapsed;

  const navItems = [
    ...(canOperarCajaYGastos ? [{ id: 'registro', label: 'Cobrar', icon: CreditCard }] : []),
    ...(canViewResumen ? [{ id: 'resumen', label: 'Caja', icon: BarChart3 }] : []),
    ...(canViewFinanzas ? [{ id: 'finanzas', label: 'Finanzas', icon: Wallet }] : []),
    ...(canViewTareas ? [{ id: 'tareas', label: 'Tareas', icon: ClipboardList }] : []),
    ...(canViewTurnosAgenda ? [{ id: 'turnos-agenda', label: 'Turnos', icon: CalendarClock }] : []),
    ...(canViewClientes ? [{ id: 'clientes', label: 'Clientes', icon: Users }] : []),
    ...(canViewMiNegocio ? [{ id: 'mi-negocio', label: 'Mi Negocio', icon: Store }] : []),
    ...(canViewConfig ? [{ id: 'config', label: 'Configuración', icon: Settings }] : []),
  ];

  const principalItems = navItems.filter((i) => !MGMT_IDS.has(i.id));
  const gestionItems = navItems.filter((i) => MGMT_IDS.has(i.id));

  const isPremium = organization?.plan === 'premium';
  const planLabel = !organization
    ? null
    : organization.plan === 'premium'
      ? 'Premium'
      : organization.plan === 'profesional'
        ? 'Profesional'
        : 'Básico';

  const daysUntilBillingEnds = subscriptionAccess?.days_until_access_ends ?? null;
  const showBillingNotice =
    subscriptionAccess?.has_access === true &&
    daysUntilBillingEnds !== null &&
    daysUntilBillingEnds > 0 &&
    daysUntilBillingEnds <= 3;

  const displayName = profile?.full_name || profile?.email || 'Usuario';
  const initials =
    (profile?.full_name || profile?.email || 'U')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join('') || 'U';

  const primaryRole = roles.find((r) => r !== 'otros');
  const primaryRoleLabel = primaryRole ? ROLE_LABELS[primaryRole] ?? null : null;

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    if (isMobile) setCollapsed(true);
  };

  const renderNavItem = (item: { id: string; label: string; icon: typeof CreditCard }, index: number) => {
    const active = activeTab === item.id;
    const Icon = item.icon;
    return (
      <li
        key={item.id}
        className="animate-item-in [animation-fill-mode:backwards]"
        style={{ animationDelay: `${index * 25}ms` }}
      >
        <button
          onClick={() => handleTabChange(item.id)}
          data-onboarding-id={item.id === 'mi-negocio' ? 'mi-negocio-nav' : undefined}
          aria-current={active ? 'page' : undefined}
          title={railMode ? item.label : undefined}
          className={cn(
            'group flex w-full items-center transition-colors duration-150',
            railMode
              ? 'justify-center'
              : cn(
                  'gap-2.5 rounded-[10px] px-2 py-1.5 text-sm',
                  active
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'font-medium text-muted-foreground hover:bg-[#F4F5F7] hover:text-foreground',
                ),
          )}
        >
          {railMode ? (
            <span
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-[10px] transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground group-hover:bg-[#F4F5F7]',
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
          ) : active ? (
            <>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-foreground/15 text-primary-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">{item.label}</span>
            </>
          ) : (
            <>
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </>
          )}
        </button>
      </li>
    );
  };

  const sectionLabel = (text: string) => (
    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {text}
    </p>
  );

  return (
    <>
      {isMobile && collapsed && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="fixed left-4 top-4 z-40 h-11 w-11 rounded-full border bg-background/95 backdrop-blur"
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {isMobile && !collapsed && (
        <button
          type="button"
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-[hsl(var(--color-950))]/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        className={cn(
          'flex flex-col border-r border-[#EEEFF2] bg-background',
          isMobile
            ? 'fixed inset-y-0 left-0 z-50 w-[min(85vw,20rem)] max-w-sm transition-transform duration-200 [transition-timing-function:var(--ease-out-quint)]'
            : 'z-10 h-full transition-[width] duration-200 [transition-timing-function:var(--ease-out-quint)]',
          !isMobile && (collapsed ? 'w-16' : 'w-56'),
        )}
        style={
          isMobile
            ? {
                transform: collapsed ? 'translate3d(-100%, 0, 0)' : 'translate3d(0, 0, 0)',
                willChange: 'transform',
                maxWidth: '100vw',
              }
            : undefined
        }
      >
        {/* Brand identity — header blanco con logo tile navy */}
        {railMode ? (
          <div className="flex items-center justify-center bg-background py-4">
            <div
              className="grid h-10 w-10 place-items-center rounded-[10px] bg-primary"
              title={organization?.name || 'Barbería'}
            >
              <img src="/favicon.png" alt="Vittro" className="h-6 w-6 object-contain" />
            </div>
          </div>
        ) : (
          <div className="bg-background px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-primary">
                <img src="/favicon.png" alt="Vittro" className="h-6 w-6 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
                  {organization?.name || 'Barbería'}
                </p>
                {planLabel && (
                  isPremium ? (
                    <span className="mt-1.5 inline-flex items-center rounded-full bg-[#C39A45] px-2 py-0.5 text-[10px] font-semibold text-white">
                      PREMIUM
                    </span>
                  ) : (
                    <span className="mt-1.5 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {planLabel}
                    </span>
                  )
                )}
                {showBillingNotice && (
                  <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-medium text-status-warning-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {daysUntilBillingEnds === 1 ? 'Vence en 1 dia' : `Vence en ${daysUntilBillingEnds} dias`}
                    </span>
                  </span>
                )}
              </div>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Cerrar navegación"
                  className="grid h-8 w-8 shrink-0 place-items-center self-start rounded-lg text-muted-foreground transition-colors hover:bg-[#F4F5F7] hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Wrapper-only styling del selector de sucursal (chip navy claro).
                El componente interno se recolorea vía overrides de descendiente
                para no tocar SucursalSelector. */}
            <div className="mt-3 w-full rounded-lg border border-primary/15 bg-primary/5 [&_[role=combobox]]:border-0 [&_[role=combobox]]:bg-transparent [&_[role=combobox]]:text-primary [&_[role=combobox]_svg]:text-primary [&>div]:border-0 [&>div]:bg-transparent [&>div]:text-primary [&>div]:ring-0">
              <SucursalSelector collapsed={false} />
            </div>
          </div>
        )}

        {railMode && <SucursalSelector collapsed />}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hide">
          {principalItems.length > 0 && (
            <div>
              {!railMode && sectionLabel('Principal')}
              <ul className="space-y-0.5">
                {principalItems.map((item, i) => renderNavItem(item, i))}
              </ul>
            </div>
          )}

          {gestionItems.length > 0 && (
            <div className="mt-3">
              {!railMode
                ? sectionLabel('Gestión')
                : principalItems.length > 0 && <div className="mx-2 my-2 h-px bg-[#EEEFF2]" />}
              <ul className="space-y-0.5">
                {gestionItems.map((item, i) => renderNavItem(item, principalItems.length + i))}
              </ul>
            </div>
          )}
        </nav>

        {/* User & session */}
        <div className="border-t border-[#EEEFF2] p-2">
          {railMode ? (
            <div className="flex flex-col items-center gap-1.5 py-2">
              <Avatar className="h-9 w-9" title={displayName}>
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {canViewTareas && (
                <div className="[&>button]:h-8 [&>button]:w-8 [&>button]:min-w-0 [&>button]:rounded-lg [&>button]:p-0">
                  <NotificationsBell collapsed onNavigate={() => handleTabChange('tareas')} />
                </div>
              )}
              {requiresPin && isUnlocked && (
                <button
                  type="button"
                  onClick={lock}
                  title={`Bloquear (${unlockedBy})`}
                  aria-label="Bloquear"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Lock className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                title="Expandir"
                aria-label="Expandir navegación"
                className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/85"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 px-2 py-2">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  {primaryRoleLabel && (
                    <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {primaryRoleLabel}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canViewTareas && (
                    <div className="[&>button]:h-8 [&>button]:w-8 [&>button]:min-w-0 [&>button]:rounded-lg [&>button]:p-0">
                      <NotificationsBell collapsed onNavigate={() => handleTabChange('tareas')} />
                    </div>
                  )}
                  {requiresPin && isUnlocked && (
                    <button
                      type="button"
                      onClick={lock}
                      title={`Bloquear (${unlockedBy})`}
                      aria-label="Bloquear"
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {!isMobile && (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  title="Colapsar"
                  aria-label="Colapsar"
                  className="mt-1 flex w-full items-center justify-center rounded-lg bg-primary py-2 text-primary-foreground transition-colors hover:bg-primary/85"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
