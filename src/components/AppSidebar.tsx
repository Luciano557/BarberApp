import { useState, useEffect } from 'react';
import { Scissors, BarChart3, Settings, ChevronLeft, ChevronRight, LogOut, Shield, UserCheck, Building2, Lock, Receipt, ClipboardList, CalendarClock, Users, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePinProtection } from '@/hooks/usePinProtection';
import { useIsMobile } from '@/hooks/use-mobile';
import { SucursalSelector } from '@/components/SucursalSelector';
import { NotificationsBell } from '@/components/notifications/NotificationsBell';

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);
  const { profile, roles, isOwner, isGeneralManager, isManager, isBarber, canManagePayments, canOperarCajaYGastos, canManageConfig, canViewConfig, canViewResumen, canViewTareas, canViewMiNegocio, canViewFinanzas, canViewTurnosAgenda, canViewClientes, signOut } = useAuth();
  const { organization } = useOrganization();
  const { isUnlocked, requiresPin, lock, unlockedBy } = usePinProtection();

  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  const navItems = [
    ...(canOperarCajaYGastos ? [{ id: 'registro', label: 'Cobrar', icon: Scissors }] : []),
    ...(canViewResumen ? [{ id: 'resumen', label: 'Caja', icon: BarChart3 }] : []),
    ...(canViewFinanzas ? [{ id: 'finanzas', label: 'Finanzas', icon: Receipt }] : []),
    ...(canViewTareas ? [{ id: 'tareas', label: 'Tareas', icon: ClipboardList }] : []),
    ...(canViewTurnosAgenda ? [{ id: 'turnos-agenda', label: 'Turnos', icon: CalendarClock }] : []),
    ...(canViewClientes ? [{ id: 'clientes', label: 'Clientes', icon: Users }] : []),
    ...(canViewMiNegocio ? [{ id: 'mi-negocio', label: 'Mi Negocio', icon: Building2 }] : []),
    ...(canViewConfig ? [{ id: 'config', label: 'Configuración', icon: Settings }] : []),
  ];

  const getRoleBadges = () => {
    const badgeMap: Record<string, { label: string; icon: typeof Shield; variant: 'default' | 'secondary' | 'outline' }> = {
      owner: { label: 'Dueño', icon: Shield, variant: 'default' },
      general_manager: { label: 'Enc. General', icon: Shield, variant: 'default' },
      manager: { label: 'Enc. Sucursal', icon: UserCheck, variant: 'secondary' },
      barber: { label: 'Barbero', icon: Scissors, variant: 'outline' },
      sucursal_account: { label: 'Cuenta de sucursal', icon: Building2, variant: 'secondary' },
    };
    return roles
      .filter(r => r !== 'otros')
      .map(r => badgeMap[r])
      .filter(Boolean);
  };

  const roleBadges = getRoleBadges();

  const getPlanBadge = () => {
    if (!organization) return null;
    switch (organization.plan) {
      case 'premium':
        return { label: 'Premium', variant: 'default' as const };
      case 'profesional':
        return { label: 'Profesional', variant: 'secondary' as const };
      default:
        return { label: 'Básico', variant: 'outline' as const };
    }
  };

  const planBadge = getPlanBadge();

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    if (isMobile) setCollapsed(true);
  };

  return (
    <>
      {isMobile && collapsed && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="fixed left-4 top-4 z-40 h-11 w-11 rounded-full border bg-background/95 shadow-sm backdrop-blur"
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {isMobile && !collapsed && (
        <button
          type="button"
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        className={cn(
          "border-r border-sidebar-border bg-sidebar flex flex-col",
          isMobile
            ? "fixed inset-y-0 left-0 z-50 w-[min(85vw,20rem)] max-w-sm transition-transform duration-200"
            : "h-full z-10 transition-[width] duration-200 [transition-timing-function:var(--ease-out-quint)]",
          isMobile
            ? (collapsed ? "-translate-x-full" : "translate-x-0")
            : (collapsed ? "w-16" : "w-56")
        )}
      >
      {/* Logo & Organization */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        <div className={cn("flex items-center gap-2 min-w-0", collapsed && "mx-auto gap-0")}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div
            className={cn(
              "min-w-0 flex-1 overflow-hidden transition-[max-width,opacity] duration-200 [transition-timing-function:var(--ease-out-quint)]",
              collapsed ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100"
            )}
          >
            <span className="font-semibold text-sidebar-foreground text-sm block truncate">
              {organization?.name || 'Barbería'}
            </span>
            {planBadge && (
              <Badge variant={planBadge.variant} className="text-[10px] px-1.5 py-0">
                {planBadge.label}
              </Badge>
            )}
          </div>
        </div>
        {isMobile && !collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(true)}
            className="h-8 w-8 shrink-0"
            aria-label="Cerrar navegación"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Sucursal Selector */}
      <SucursalSelector collapsed={collapsed} />

      {/* User Info */}
      {!collapsed && profile && (
        <div className="px-3 py-3 border-b border-sidebar-border">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {profile.full_name || profile.email}
          </p>
          {roleBadges.map((badge, i) => (
            <Badge key={i} variant={badge.variant} className="mt-1 text-xs mr-1">
              <badge.icon className="w-3 h-3 mr-1" />
              {badge.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleTabChange(item.id)}
                data-onboarding-id={item.id === 'mi-negocio' ? 'mi-negocio-nav' : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 relative",
                  collapsed && "justify-center gap-0 px-2",
                  activeTab === item.id
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent"
                )}
                title={collapsed ? item.label : undefined}
              >
                {activeTab === item.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                )}
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 [transition-timing-function:var(--ease-out-quint)]",
                    collapsed ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100"
                  )}
                >
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Notifications */}
      {canViewTareas && (
        <div className="p-2 border-t border-sidebar-border">
          <NotificationsBell
            collapsed={collapsed}
            onNavigate={() => handleTabChange('tareas')}
          />
        </div>
      )}

      {/* Lock, Logout & Toggle */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {requiresPin && isUnlocked && (
          <Button
            variant="ghost"
            size="sm"
            onClick={lock}
            className={cn(
              "w-full h-9 text-muted-foreground hover:text-foreground justify-start",
              collapsed && "px-2 justify-center"
            )}
            title={collapsed ? `Bloquear (${unlockedBy})` : undefined}
          >
            <Lock className="h-4 w-4" />
            <span
              className={cn(
                "ml-2 text-xs overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 [transition-timing-function:var(--ease-out-quint)]",
                collapsed ? "ml-0 max-w-0 opacity-0" : "max-w-[140px] opacity-100"
              )}
            >
              Bloquear
            </span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className={cn(
            "w-full h-9 text-muted-foreground hover:text-destructive justify-start",
            collapsed && "px-2 justify-center"
          )}
        >
          <LogOut className="h-4 w-4" />
          <span
            className={cn(
              "ml-2 text-xs overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 [transition-timing-function:var(--ease-out-quint)]",
              collapsed ? "ml-0 max-w-0 opacity-0" : "max-w-[140px] opacity-100"
            )}
          >
            Cerrar sesión
          </span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full h-9 text-muted-foreground hover:text-foreground",
            collapsed && "px-2"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span className="text-xs">{isMobile ? 'Cerrar menú' : 'Colapsar'}</span>
            </>
          )}
        </Button>
      </div>
      </aside>
    </>
  );
}
