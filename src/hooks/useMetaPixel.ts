import { useEffect } from 'react';
import { initMetaPixel, resetMetaPixel } from '@/lib/analytics/metaPixel';
import { useConsent } from '@/hooks/useConsent';

/**
 * Carga condicional del pixel: espera consentimiento aceptado Y un pixelId
 * disponible a la vez, sin importar el orden en que se cumplan (ambos son
 * dependencias del mismo efecto). Si pixelId cambia (navegación entre
 * portales de organizaciones distintas sin reload), initMetaPixel detecta
 * el cambio y reinicializa; si pixelId se pierde, resetMetaPixel limpia la
 * guarda local.
 */
export function useMetaPixel(pixelId: string | null | undefined): void {
  const { status } = useConsent();

  useEffect(() => {
    if (status === 'accepted' && pixelId) {
      initMetaPixel(pixelId);
    } else if (!pixelId) {
      resetMetaPixel();
    }
  }, [status, pixelId]);
}
