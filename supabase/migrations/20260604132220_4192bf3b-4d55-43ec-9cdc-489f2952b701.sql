-- =========================================================
-- Idempotencia del motor de tareas recurrentes
-- =========================================================
-- Garantiza que nunca existan dos tareas generadas para el
-- mismo ciclo (misma receta + misma fecha de inicio), aunque
-- el motor de generación se ejecute en paralelo o se reintente.
--
-- Se implementa como índice UNIQUE PARCIAL porque:
--   * Tareas manuales (recurrencia_id IS NULL) deben poder
--     repetir fecha_inicio sin restricciones.
--   * ALTER TABLE ADD CONSTRAINT UNIQUE no admite WHERE en
--     PostgreSQL; los índices parciales únicos requieren
--     CREATE UNIQUE INDEX.
--
-- Nota: el motor DEBE generar siempre fecha_inicio NOT NULL.
-- Si una fila recurrente quedara con fecha_inicio NULL, este
-- índice no bloquearía duplicados (NULL ≠ NULL en UNIQUE).

CREATE UNIQUE INDEX IF NOT EXISTS uq_tareas_recurrencia_fecha
  ON public.tareas (recurrencia_id, fecha_inicio)
  WHERE recurrencia_id IS NOT NULL
    AND fecha_inicio IS NOT NULL;

COMMENT ON INDEX public.uq_tareas_recurrencia_fecha IS
  'Idempotencia del motor de tareas recurrentes: impide generar dos tareas '
  'para la misma receta (recurrencia_id) y el mismo ciclo (fecha_inicio). '
  'Parcial: solo aplica a tareas generadas por una receta (recurrencia_id NOT NULL) '
  'con fecha asignada (fecha_inicio NOT NULL). No afecta tareas manuales.';