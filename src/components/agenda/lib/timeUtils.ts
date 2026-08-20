export const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const minutesToTime = (m: number): string => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const formatHHMM = (t: string) => t.slice(0, 5);

/**
 * Zoom de la vista Día: 3 niveles discretos de densidad vertical, no un
 * rango continuo. Consumido solo por AgendaDayView.tsx (Multi-día tiene su
 * propia escala independiente, MULTI_PX_PER_MIN en multiDayLayout.ts —
 * no se tocan entre sí).
 *
 * "normal" es el valor histórico de PX_PER_MIN: sin cambios de
 * comportamiento para quien no toque el control de zoom.
 *
 * "compact" quedó en 1.6 (no el ~1.4 sugerido originalmente): a 1.4,
 * un turno de 15min renderiza a ~21px, pegado al piso Math.max(20, ...)
 * de AgendaDayView — casi indistinguible del piso y con el contenido
 * (una sola línea de nombre truncado, ver la escalera de abajo) muy
 * ajustado. A 1.6, ese mismo turno da 24px, holgado para una línea.
 */
export type ZoomLevel = 'compact' | 'normal' | 'wide';

export const ZOOM_LEVELS: ZoomLevel[] = ['compact', 'normal', 'wide'];

export const ZOOM_PX_PER_MIN: Record<ZoomLevel, number> = {
  compact: 1.6, // ~96px por hora
  normal: 2.05, // ~123px por hora — valor original de PX_PER_MIN
  wide: 3, // ~180px por hora
};

/** Umbral de la escalera de contenido de la tarjeta de turno (AgendaDayView):
 *  por debajo de esta altura, la tarjeta solo muestra el nombre truncado
 *  (sin hora) — ver el bloque de render de turnos para el resto de la
 *  escalera (32-45px: +hora, 45px+: +servicio, umbral preexistente). */
const CARD_LEGIBILITY_FLOOR_PX = 32;

/**
 * Elige el nivel de zoom automático: el más alto (más px/min) que muestre
 * `workSpanMinutes` sin scroll dentro de `containerHeightPx`. Si ninguno
 * entra, cae a "compact". Guarda de legibilidad: si el turno más corto del
 * día quedaría en el tier "solo nombre" (< CARD_LEGIBILITY_FLOOR_PX) en el
 * nivel elegido, sube un nivel y acepta que haya scroll — priorizar poder
 * leer el turno sobre que quepa todo el rango sin scrollear.
 */
export function pickAutoZoomLevel(
  workSpanMinutes: number,
  containerHeightPx: number,
  shortestTurnoMinutes: number | null,
): ZoomLevel {
  const order: ZoomLevel[] = ['wide', 'normal', 'compact'];
  let chosenIdx = order.length - 1; // compact por defecto si ninguno entra

  for (let i = 0; i < order.length; i++) {
    if (workSpanMinutes * ZOOM_PX_PER_MIN[order[i]] <= containerHeightPx) {
      chosenIdx = i;
      break;
    }
  }

  if (shortestTurnoMinutes != null) {
    while (
      chosenIdx > 0 &&
      shortestTurnoMinutes * ZOOM_PX_PER_MIN[order[chosenIdx]] < CARD_LEGIBILITY_FLOOR_PX
    ) {
      chosenIdx -= 1;
    }
  }

  return order[chosenIdx];
}
