import { useEffect, useState } from 'react';
import { useProgressiveLoading } from '@/hooks/useProgressiveLoading';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { supabase } from '@/integrations/supabase/client';
import { VittroMark } from '@/components/VittroMark';
import { cn } from '@/lib/utils';

// Debe coincidir con la duración de `animate-screen-out` (220ms, tailwind.config.ts)
// más el stagger de 80ms que la precede.
const SCREEN_OUT_DELAY_MS = 80;
const SCREEN_OUT_DURATION_MS = 220;
export const LOADING_SCREEN_EXIT_MS = SCREEN_OUT_DELAY_MS + SCREEN_OUT_DURATION_MS;

/**
 * El padre debe seguir renderizando <LoadingScreen loading={...}/> por
 * LOADING_SCREEN_EXIT_MS después de que `loading` pase a false, para darle
 * tiempo a la animación de salida antes del desmontaje real.
 */
export function useLoadingScreenMounted(loading: boolean): boolean {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(loading);

  useEffect(() => {
    if (loading) {
      setMounted(true);
      return;
    }
    if (prefersReducedMotion) {
      setMounted(false);
      return;
    }
    const timer = setTimeout(() => setMounted(false), LOADING_SCREEN_EXIT_MS);
    return () => clearTimeout(timer);
  }, [loading, prefersReducedMotion]);

  return mounted;
}

interface Props {
  /** Texto principal del loader (ej: "Verificando sesión...") */
  message: string;
  /** Callback de reintento. Se muestra como botón a partir de los 25s. */
  onRetry?: () => void;
  /** Mensaje fatal que se muestra a los 90s. */
  fatalMessage?: string;
  /**
   * Estado real de carga. Al pasar a false dispara la secuencia de salida
   * (logo-exit, luego screen-out); el componente sigue montado durante esa
   * secuencia — quien lo use debe gatear el montaje con useLoadingScreenMounted,
   * no con este prop directamente.
   */
  loading: boolean;
}

type LogoPhase = 'entering' | 'idle' | 'exiting';

/**
 * Loader con fallback progresivo.
 * - 8s: aviso "Esto está tardando más de lo normal..."
 * - 25s: botón "Reintentar"
 * - 90s: pantalla recuperable con Reintentar + Cerrar sesión
 *
 * No cierra sesión ni navega automáticamente: solo da salida manual al usuario.
 */
export function LoadingScreen({ message, onRetry, fatalMessage, loading }: Props) {
  const { delayed, showRetry, fatal } = useProgressiveLoading(loading);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [logoPhase, setLogoPhase] = useState<LogoPhase>('entering');
  const [screenExiting, setScreenExiting] = useState(false);

  useEffect(() => {
    if (loading) {
      setLogoPhase(p => (p === 'exiting' ? 'entering' : p));
      setScreenExiting(false);
      return;
    }
    setLogoPhase('exiting');
    if (prefersReducedMotion) {
      setScreenExiting(true);
      return;
    }
    const timer = setTimeout(() => setScreenExiting(true), SCREEN_OUT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading, prefersReducedMotion]);

  const isExiting = logoPhase === 'exiting';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Divisor entre marca y texto: vertical en fila (desktop/tablet), horizontal
  // apilado (mobile) — mismo elemento, solo rota de eje. Composición V5 (ver
  // scratchpad/loader-variantes.html), aprobada para C4B.
  const divider = (
    <div className="h-px w-7 shrink-0 self-center bg-border sm:h-auto sm:w-px sm:self-stretch" />
  );

  if (fatal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3.5 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
          {/* Marca estática (sin logo-enter/breathe): mismo criterio que
              RecoverableErrorScreen — esto no es un estado de carga. */}
          <VittroMark className="h-auto w-[36px] shrink-0 text-primary sm:w-[42px]" />
          {divider}
          <div className="flex min-w-0 max-w-sm flex-col items-center gap-2 sm:items-start">
            <p className="text-sm font-semibold text-foreground">
              No pudimos terminar de cargar tu sesión
            </p>
            <p className="text-xs text-muted-foreground">
              {fatalMessage ?? 'Puede deberse a una conexión lenta o a un problema temporal.'}
            </p>
            <div className="flex justify-center gap-2 sm:justify-start">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition"
                >
                  Reintentar
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-md border border-border text-xs text-foreground hover:bg-muted transition"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-screen bg-background flex items-center justify-center px-4',
        screenExiting ? 'animate-screen-out' : 'animate-screen-in',
        isExiting && 'pointer-events-none'
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-3.5 sm:text-left">
        <div
          className={cn(
            'shrink-0',
            logoPhase === 'entering' && 'opacity-0 animate-logo-enter',
            logoPhase === 'idle' && 'animate-logo-breathe',
            logoPhase === 'exiting' && 'animate-logo-exit'
          )}
          onAnimationEnd={e => {
            if (e.animationName === 'logo-enter' && logoPhase === 'entering') {
              setLogoPhase('idle');
            }
          }}
        >
          <VittroMark className="h-auto w-[36px] text-primary sm:w-[42px]" />
        </div>
        {divider}
        <div className="flex min-w-0 max-w-sm flex-col items-center gap-2 sm:items-start">
          <p className="text-sm text-muted-foreground">{message}</p>
          {delayed && (
            <p className="text-xs text-muted-foreground/70">
              Esto está tardando más de lo normal...
            </p>
          )}
          {showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 rounded-md border border-border text-xs text-foreground hover:bg-muted transition"
            >
              Reintentar
            </button>
          )}
        </div>
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
 * Mismo contenedor/tipografía que LoadingScreen; logo estático (sin
 * logo-enter ni logo-breathe) porque esto no es un estado de carga.
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
        <VittroMark className="w-[clamp(72px,9vw,128px)] h-auto mx-auto mb-4 text-primary" />
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
