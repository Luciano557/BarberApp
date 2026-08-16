import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useConsent } from '@/hooks/useConsent';

// Variable CSS que expone la altura real del banner para que páginas con
// contenido pegado al borde inferior (ej. Reservar) puedan reservar el
// espacio exacto en vez de adivinar un padding fijo. 0px cuando está oculto.
const HEIGHT_VAR = '--consent-banner-h';

/** Barra angosta de ancho completo anclada abajo — no floating card, no modal.
    Se auto-oculta apenas hay una decisión vigente (aceptada o rechazada). */
export function CookieConsentBanner() {
  const { status, accept, reject } = useConsent();
  const ref = useRef<HTMLDivElement>(null);
  const visible = status === null;

  useEffect(() => {
    if (!visible) {
      document.documentElement.style.setProperty(HEIGHT_VAR, '0px');
      return;
    }
    const el = ref.current;
    if (!el) return;
    const setHeight = () => document.documentElement.style.setProperty(HEIGHT_VAR, `${el.offsetHeight}px`);
    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty(HEIGHT_VAR, '0px');
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background shadow-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="region"
      aria-label="Consentimiento de cookies"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Usamos cookies para medir el rendimiento de nuestras campañas y mejorar tu experiencia.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={reject}>
            Rechazar
          </Button>
          <Button type="button" size="sm" onClick={accept}>
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
}
