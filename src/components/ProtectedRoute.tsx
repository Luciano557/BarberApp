import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ChangePasswordForm } from './ChangePasswordForm';
import { LoadingScreen, RecoverableErrorScreen } from './LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, roles, isLoading, mustChangePassword, signOut } = useAuth();
  const { organization, isLoading: orgLoading, error: orgError, refreshOrganization } = useOrganization();
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const [passwordChanged, setPasswordChanged] = useState(false);

  // 1. Mientras realmente se está inicializando, mostrar loader con fallback progresivo.
  if (isLoading || orgLoading) {
    return (
      <LoadingScreen
        message="Verificando sesión..."
        onRetry={() => refreshOrganization()}
      />
    );
  }

  // 2. Sin sesión → al login.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Email no verificado (excepto invitados).
  const isInvited = user.user_metadata?.invited_by != null;
  if (!user.email_confirmed_at && !isInvited) {
    return <Navigate to="/verify-email" replace />;
  }

  // 4. Forzar cambio de contraseña si corresponde.
  if (mustChangePassword && !passwordChanged) {
    return <ChangePasswordForm onSuccess={() => setPasswordChanged(true)} />;
  }

  // 5. Hay user pero la organización no se pudo cargar → pantalla recuperable.
  if (!organization && orgError) {
    return (
      <RecoverableErrorScreen
        title="No pudimos cargar tu cuenta"
        description={orgError}
        onRetry={() => refreshOrganization()}
        onSignOut={async () => {
          await signOut();
          window.location.href = '/login';
        }}
      />
    );
  }

  // 6. Validar slug en URL.
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
