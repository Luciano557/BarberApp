import { useState, useEffect } from 'react';
import { Scissors, BarChart3, Settings, ChevronLeft, ChevronRight, LogOut, Shield, UserCheck, Building2, Wallet, Lock, TrendingUp, Receipt, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePinProtection } from '@/hooks/usePinProtection';
import { useIsMobile } from '@/hooks/use-mobile';
import { SucursalSelector } from '@/components/SucursalSelector';

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);
  const { profile, roles, isOwner, isGeneralManager, isManager, isBarber, canManagePayments, canManageConfig, canViewResumen, canViewTareas, signOut } = useAuth();
  const { organization } = useOrganization();
  const { isUnlocked, requiresPin, lock, unlockedBy } = usePinProtection();

  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  // Filter nav items based on permissions
  const navItems = [
    ...(canManagePayments ? [{ id: 'registro', label: 'Cobrar', icon: Scissors }] : []),
    ...(canViewResumen ? [{ id: 'resumen', label: 'Resumen', icon: BarChart3 }] : []),
    ...(canManageConfig ? [{ id: 'estadisticas', label: 'Estadísticas', icon: TrendingUp }] : []),
    ...(canManageConfig ? [{ id: 'sueldos', label: 'Sueldos', icon: Wallet }] : []),
    ...(canManageConfig ? [{ id: 'finanzas', label: 'Finanzas', icon: Receipt }] : []),
    ...(canViewTareas ? [{ id: 'tareas', label: 'Tareas', icon: ClipboardList }] : []),
    ...(isOwner || isGeneralManager ? [{ id: 'mi-negocio', label: 'Mi Negocio', icon: Building2 }] : []),
    ...(canManageConfig ? [{ id: 'config', label: 'Configuración', icon: Settings }] : []),
  ];

  const getRoleBadges = () => {
    const badgeMap: Record<string, { label: string; icon: typeof Shield; variant: 'default' | 'secondary' | 'outline' }> = {
      owner: { label: 'Dueño', icon: Shield, variant: 'default' },
      general_manager: { label: 'Enc. General', icon: Shield, variant: 'default' },
      manager: { label: 'Enc. Local', icon: UserCheck, variant: 'secondary' },
      barber: { label: 'Barbero', icon: Scissors, variant: 'outline' },
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
        return { label: 'Premium', className: 'bg-amber-500/20 text-amber-600 border-amber-500/30' };
      case 'basic':
        return { label: 'Basic', className: 'bg-blue-500/20 text-blue-600 border-blue-500/30' };
      default:
        return { label: 'Free', className: 'bg-muted text-muted-foreground' };
    }
  };

  const planBadge = getPlanBadge();

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    if (isMobile) setCollapsed(true);
  };

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200 z-10",
        isMobile ? "fixed top-0 left-0" : "sticky top-0",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo & Organization */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              <Building2 className="h-4 w-4 text-secondary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-sidebar-foreground text-sm block truncate">
                {organization?.name || 'Barbería'}
              </span>
              {planBadge && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", planBadge.className)}>
                  {planBadge.label}
                </Badge>
              )}
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mx-auto">
            <Building2 className="h-4 w-4 text-secondary-foreground" />
          </div>
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
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  collapsed && "justify-center px-2",
                  activeTab === item.id
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-muted"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Lock, Logout & Toggle */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {/* Lock Button - only show when unlocked and PIN is required */}
        {requiresPin && isUnlocked && (
          <Button
            variant="ghost"
            size="sm"
            onClick={lock}
            className={cn(
              "w-full h-9 text-amber-600 hover:text-amber-700 hover:bg-amber-50 justify-start",
              collapsed && "px-2 justify-center"
            )}
            title={collapsed ? `Bloquear (${unlockedBy})` : undefined}
          >
            <Lock className="h-4 w-4" />
            {!collapsed && <span className="ml-2 text-xs">Bloquear</span>}
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
          {!collapsed && <span className="ml-2 text-xs">Cerrar sesión</span>}
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
              <span className="text-xs">Colapsar</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
