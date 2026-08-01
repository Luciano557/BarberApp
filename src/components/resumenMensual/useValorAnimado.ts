import { useLayoutEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/** Duración por defecto de los reveals de la historia (count-up y barrido del donut). */
export const DURACION_REVEAL_MS = 700;

/**
 * Equivalente en JS de la curva del token CSS `--ease-out-quint`
 * (`cubic-bezier(0.23, 1, 0.32, 1)`). Ni requestAnimationFrame ni recharts pueden
 * leer un cubic-bezier declarado en CSS, así que la curva se replica acá para que
 * el movimiento por JS coincida con el resto del sistema de motion.
 */
function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * Interpola `desde` → `hasta` al montar, con la curva de salida del sistema.
 *
 * Devuelve `hasta` como estado inicial a propósito: si el rAF nunca llega a correr
 * (reduced motion, pestaña oculta, render headless) el valor correcto ya está en
 * pantalla. La animación mejora un default visible, nunca lo condiciona.
 */
export function useValorAnimado(
  desde: number,
  hasta: number,
  duracionMs: number = DURACION_REVEAL_MS,
): number {
  const prefiereMenosMovimiento = usePrefersReducedMotion();
  const [valor, setValor] = useState(hasta);
  const rafRef = useRef(0);

  useLayoutEffect(() => {
    if (prefiereMenosMovimiento) {
      setValor(hasta);
      return;
    }

    let inicio = 0;
    setValor(desde);

    const paso = (ahora: number) => {
      if (inicio === 0) inicio = ahora;
      const t = Math.min((ahora - inicio) / duracionMs, 1);
      if (t >= 1) {
        // Aterriza en el valor exacto, sin arrastrar el error de la interpolación.
        setValor(hasta);
        return;
      }
      setValor(desde + (hasta - desde) * easeOutQuint(t));
      rafRef.current = requestAnimationFrame(paso);
    };

    rafRef.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(rafRef.current);
  }, [desde, hasta, duracionMs, prefiereMenosMovimiento]);

  return valor;
}
