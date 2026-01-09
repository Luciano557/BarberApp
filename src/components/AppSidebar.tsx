import { useState } from 'react';
import { Scissors, BarChart3, Settings, ChevronLeft, ChevronRight, LogOut, Shield, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, roles, isOwner, isManager, isBarber, canManagePayments, canManageConfig, signOut } = useAuth();

  // Filter nav items based on permissions
  const navItems = [
    ...(canManagePayments ? [{ id: 'registro', label: 'Cobrar', icon: Scissors }] : []),
    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
    ...(canManageConfig ? [{ id: 'config', label: 'Configuración', icon: Settings }] : []),
  ];

  const getRoleBadge = () => {
    if (isOwner) return { label: 'Dueño', icon: Shield, variant: 'default' as const };
    if (isManager) return { label: 'Encargado', icon: UserCheck, variant: 'secondary' as const };
    if (isBarber) return { label: 'Barbero', icon: Scissors, variant: 'outline' as const };
    return null;
  };

  const roleBadge = getRoleBadge();

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col sticky top-0 transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              <Scissors className="h-4 w-4 text-secondary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground text-sm">BarberPOS</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mx-auto">
            <Scissors className="h-4 w-4 text-secondary-foreground" />
          </div>
        )}
      </div>

      {/* User Info */}
      {!collapsed && profile && (
        <div className="px-3 py-3 border-b border-sidebar-border">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {profile.full_name || profile.email}
          </p>
          {roleBadge && (
            <Badge variant={roleBadge.variant} className="mt-1 text-xs">
              <roleBadge.icon className="w-3 h-3 mr-1" />
              {roleBadge.label}
            </Badge>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onTabChange(item.id)}
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

      {/* Logout & Toggle */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
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
