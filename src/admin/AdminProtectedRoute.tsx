import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

interface AdminRouteGuardProps {
  children?: ReactNode;
  loadingFallback?: ReactNode;
}

function DefaultLoadingFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      Verificando acceso administrativo…
    </div>
  );
}

export function AdminProtectedRoute({
  children,
  loadingFallback,
}: AdminRouteGuardProps) {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return <>{loadingFallback ?? <DefaultLoadingFallback />}</>;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

export function AdminGuestRoute({
  children,
  loadingFallback,
}: AdminRouteGuardProps) {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return <>{loadingFallback ?? <DefaultLoadingFallback />}</>;
  }

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
