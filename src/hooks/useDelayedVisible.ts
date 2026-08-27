import { useEffect, useState } from 'react';

/**
 * Retrasa mostrar `true` hasta que `active` lleve `delay`ms activo — evita el
 * flash de skeleton en cargas rápidas. Si `active` vuelve a `false` antes del
 * delay, nunca llega a mostrarse. Solo gatea la PRESENTACIÓN: no retrasa el
 * fetch ni impone una duración mínima — si los datos llegan antes del delay,
 * el consumidor pasa directo al contenido.
 */
export function useDelayedVisible(active: boolean, delay = 180): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);

  return visible;
}
