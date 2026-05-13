import { useProgressiveLoading } from '@/hooks/useProgressiveLoading';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  /** Texto principal del loader (ej: "Verificando sesión...") */
  message: string;
  /** Callback de reintento. Se muestra como botón a partir de los 25s. */
  onRetry?: () => void;
  /** Mensaje fatal que se muestra a los 90s. */
  fatalMessage?: string;
}

/**
 * Loader con fallback progresivo.
 * - 8s: aviso "Esto está tardando más de lo normal..."
 * - 25s: botón "Reintentar"
 * - 90s: pantalla recuperable con Reintentar + Cerrar sesión
 *
 * No cierra sesión ni navega automáticamente: solo da salida manual al usuario.
 */
export function LoadingScreen({ message, onRetry, fatalMessage }: Props) {
  const { delayed, showRetry, fatal } = useProgressiveLoading(true);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (fatal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            No pudimos terminar de cargar tu sesión
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {fatalMessage ?? 'Puede deberse a una conexión lenta o a un problema temporal.'}
          </p>
          <div className="flex gap-3 justify-center">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
              >
                Reintentar
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-md border border-border text-foreground text-sm font-medium hover:bg-muted transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">{message}</p>
        {delayed && (
          <p className="text-muted-foreground/70 text-xs mt-3">
            Esto está tardando más de lo normal...
          </p>
        )}
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-3 py-1.5 rounded-md border border-border text-xs text-foreground hover:bg-muted transition"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}

interface RecoverableProps {
  title: string;
  description?: string;
  onRetry: () => void;
  onSignOut?: () => void;
}

/**
 * Pantalla de error recuperable con dos acciones: Reintentar y Cerrar sesión.
 */
export function RecoverableErrorScreen({
  title,
  description,
  onRetry,
  onSignOut,
}: RecoverableProps) {
  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
      return;
    }
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground mb-2">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm mb-6">{description}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            Reintentar
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-md border border-border text-foreground text-sm font-medium hover:bg-muted transition"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
