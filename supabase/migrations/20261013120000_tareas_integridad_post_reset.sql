-- =====================================================================================================
-- Etapa 3 · 3B — Integridad definitiva de `tareas` después del reset pre-lanzamiento.
--   * `tareas.tipo` pasa a un CHECK validado: solo 'tarea' y 'peticion'. Reemplaza al trigger temporal
--     `trg_tareas_tipo_guard` (E2-M4), que existía solo porque había filas 'admin' históricas que un CHECK
--     habría bloqueado. El trigger no hacía nada más (rechazar un tipo inválido al insertar o al cambiarlo),
--     así que se elimina junto con su función.
--   * Una ocurrencia de Tarea automática (`recurrencia_id` no nulo) es siempre 'tarea' y tiene fecha
--     (`tareas_recurrencia_check`): así `uq_tareas_recurrencia_fecha` cubre a todas. El ON DELETE SET NULL
--     de la receta sigue funcionando (deja `recurrencia_id` en NULL).
-- Requiere el reset de la Etapa 3 ya ejecutado: aborta, sin tocar nada, si queda algún valor inválido.
-- No modifica datos, RLS, grants, crons ni funciones del motor.
-- =====================================================================================================

DO $preflight$
DECLARE
  v_tipos integer;
  v_ocurrencias integer;
BEGIN
  SELECT count(*) INTO v_tipos FROM public.tareas WHERE tipo IS NULL OR tipo NOT IN ('tarea', 'peticion');
  SELECT count(*) INTO v_ocurrencias FROM public.tareas
   WHERE recurrencia_id IS NOT NULL AND (tipo IS DISTINCT FROM 'tarea' OR fecha_inicio IS NULL);
  IF v_tipos > 0 OR v_ocurrencias > 0 THEN
    RAISE EXCEPTION 'E3B: hay % tareas con tipo fuera de tarea/peticion y % ocurrencias automáticas inválidas. Ejecutar antes el reset de la Etapa 3.',
      v_tipos, v_ocurrencias;
  END IF;
END
$preflight$;

ALTER TABLE public.tareas DROP CONSTRAINT IF EXISTS tareas_tipo_check;
ALTER TABLE public.tareas ADD CONSTRAINT tareas_tipo_check CHECK (tipo IN ('tarea', 'peticion'));

ALTER TABLE public.tareas DROP CONSTRAINT IF EXISTS tareas_recurrencia_check;
ALTER TABLE public.tareas ADD CONSTRAINT tareas_recurrencia_check
  CHECK (recurrencia_id IS NULL OR (tipo = 'tarea' AND fecha_inicio IS NOT NULL));

DROP TRIGGER IF EXISTS trg_tareas_tipo_guard ON public.tareas;
DROP FUNCTION IF EXISTS public.trg_tareas_tipo_guard();

DO $verifica$
BEGIN
  IF (SELECT count(*) FROM pg_constraint
       WHERE conrelid = 'public.tareas'::regclass AND conname IN ('tareas_tipo_check', 'tareas_recurrencia_check') AND convalidated) <> 2 THEN
    RAISE EXCEPTION 'E3B: los CHECK de tareas no quedaron validados';
  END IF;
  IF to_regprocedure('public.trg_tareas_tipo_guard()') IS NOT NULL THEN
    RAISE EXCEPTION 'E3B: el trigger temporal de tipo sigue presente';
  END IF;
END
$verifica$;
