-- =====================================================================================================
-- Etapa 2 · E2-M4 — Integridad de `tareas.tipo` y `tareas.estado`
--
-- Qué hace:
--   * `tareas.tipo` solo puede ser 'tarea' o 'peticion' en filas NUEVAS o cuando se cambia el tipo.
--     Se hace con un trigger y NO con un CHECK porque existen filas históricas con tipo 'admin' vinculadas
--     a Tareas automáticas: `tareas.recurrencia_id` es ON DELETE SET NULL, y borrar una Tarea automática
--     actualiza esas filas; un CHECK (aunque sea NOT VALID) rechazaría ese UPDATE y bloquearía el borrado.
--     La conversión o eliminación de los 'admin' históricos pertenece a la Etapa 3.
--   * `tareas.estado` queda limitado al conjunto que usa la aplicación (CHECK, NOT VALID y luego
--     VALIDATE solo si ninguna fila lo viola).
--
-- No modifica ni elimina ninguna fila.
-- =====================================================================================================

DO $preflight$
DECLARE
  v_fuera_de_estado integer;
  v_admin integer;
BEGIN
  IF to_regclass('public.tareas') IS NULL THEN
    RAISE EXCEPTION 'E2-M4 abortada: falta la tabla tareas.';
  END IF;
  SELECT count(*) INTO v_fuera_de_estado FROM public.tareas
   WHERE estado NOT IN ('pendiente', 'en_progreso', 'completada', 'vencida', 'rechazada', 'aprobada');
  SELECT count(*) INTO v_admin FROM public.tareas WHERE tipo NOT IN ('tarea', 'peticion');
  RAISE NOTICE 'E2-M4 preflight: % tareas con un estado fuera del conjunto conocido; % tareas con tipo fuera de (tarea, peticion), que no se tocan.',
    v_fuera_de_estado, v_admin;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.trg_tareas_tipo_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.tipo NOT IN ('tarea', 'peticion')
     AND (TG_OP = 'INSERT' OR NEW.tipo IS DISTINCT FROM OLD.tipo) THEN
    RAISE EXCEPTION 'Tipo de tarea no válido.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_tareas_tipo_guard ON public.tareas;
CREATE TRIGGER trg_tareas_tipo_guard
  BEFORE INSERT OR UPDATE OF tipo ON public.tareas
  FOR EACH ROW EXECUTE FUNCTION public.trg_tareas_tipo_guard();

REVOKE ALL ON FUNCTION public.trg_tareas_tipo_guard() FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.tareas DROP CONSTRAINT IF EXISTS tareas_estado_check;
ALTER TABLE public.tareas
  ADD CONSTRAINT tareas_estado_check
  CHECK (estado IN ('pendiente', 'en_progreso', 'completada', 'vencida', 'rechazada', 'aprobada')) NOT VALID;

DO $validate$
BEGIN
  ALTER TABLE public.tareas VALIDATE CONSTRAINT tareas_estado_check;
  RAISE NOTICE 'E2-M4: restricción tareas_estado_check validada.';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'E2-M4: tareas_estado_check queda NOT VALID (hay filas históricas fuera del conjunto; no se modifican).';
END
$validate$;
