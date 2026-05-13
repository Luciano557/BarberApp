import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ChangePasswordForm } from './ChangePasswordForm';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, roles, isLoading, mustChangePassword } = useAuth();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const [passwordChanged, setPasswordChanged] = useState(false);

  if (isLoading || orgLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Bloquear acceso si el email no está verificado (excepto invitados)
  const isInvited = user.user_metadata?.invited_by != null;
  if (!user.email_confirmed_at && !isInvited) {
    return <Navigate to="/verify-email" replace />;
  }

  // Force password change for invited users + sucursal accounts on first login / after reset
  if (mustChangePassword && !passwordChanged) {
    return <ChangePasswordForm onSuccess={() => setPasswordChanged(true)} />;
  }

  // Validate :orgSlug matches user's organization
  if (orgSlug && organization && orgSlug !== organization.slug) {
    return <Navigate to={`/app/${organization.slug}`} replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive mb-2">Acceso Denegado</h1>
            <p className="text-muted-foreground">No tenés permisos para acceder a esta sección.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
