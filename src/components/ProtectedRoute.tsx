import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { ChangePasswordForm } from './ChangePasswordForm';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, roles, isLoading } = useAuth();
  const [passwordChanged, setPasswordChanged] = useState(false);

  if (isLoading) {
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

  // Check if user needs to change password (invited users)
  const mustChangePassword = user.user_metadata?.must_change_password === true;
  
  if (mustChangePassword && !passwordChanged) {
    return <ChangePasswordForm onSuccess={() => setPasswordChanged(true)} />;
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
