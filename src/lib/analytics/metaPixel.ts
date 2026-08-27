// Wrapper mínimo sobre el Meta Pixel (fbq). No usa fbq('track', ...) genérico:
// usa fbq('trackSingle', pixelId, ...) en todas las llamadas para evitar que un
// evento se dispare hacia todos los pixels que hayan quedado registrados en
// window.fbq durante la sesión (relevante acá porque el visitante puede navegar
// de un portal de organización a otro sin recarga completa — SPA).
type FbqFn = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: FbqFn;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

// Único pixel "activo" en un momento dado. No es un registro de todos los IDs
// que window.fbq conoce (eso está fuera de nuestro control) — es la guarda
// local que decide si trackMetaEvent dispara o no-opea.
let activePixelId: string | null = null;

function ensureSnippetLoaded(): void {
  if (typeof window === 'undefined' || window.fbq) return;

  const fbq: FbqFn = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue!.push(args);
    }
  };
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  const firstScript = document.getElementsByTagName('script')[0];
  firstScript?.parentNode?.insertBefore(script, firstScript);
}

/**
 * Idempotente: si pixelId ya es el activo, no reinyecta ni vuelve a disparar
 * PageView (cubre re-renders, StrictMode, llamadas repetidas del hook). Si
 * cambia (navegación entre portales de organizaciones distintas sin reload),
 * inicializa el nuevo ID y dispara un PageView propio para ese pixel.
 */
export function initMetaPixel(pixelId: string): void {
  if (!pixelId) return;
  ensureSnippetLoaded();
  if (pixelId === activePixelId) return;

  window.fbq?.('init', pixelId);
  activePixelId = pixelId;
  window.fbq?.('trackSingle', pixelId, 'PageView');
}

/**
 * No-op si no hay pixelId, si fbq no cargó, o si pixelId no es el pixel
 * activo — este último caso cubre tanto "sin consentimiento" (nunca se llamó
 * a initMetaPixel, activePixelId sigue null) como "ID de otra organización"
 * (protección de aislamiento cross-org).
 */
export function trackMetaEvent(
  pixelId: string | null | undefined,
  eventName: 'CompleteRegistration' | 'Schedule',
  params?: Record<string, unknown>,
): void {
  if (!pixelId || pixelId !== activePixelId || !window.fbq) return;
  window.fbq('trackSingle', pixelId, eventName, params ?? {});
}

/** Higiene defensiva: se llama cuando la organización activa se queda sin
 * meta_pixel_id, para que un trackMetaEvent posterior no pueda coincidir
 * por accidente con un activePixelId que ya no corresponde a esta página. */
export function resetMetaPixel(): void {
  activePixelId = null;
}

export function getActiveMetaPixelId(): string | null {
  return activePixelId;
}
