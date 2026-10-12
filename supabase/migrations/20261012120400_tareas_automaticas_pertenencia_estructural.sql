-- =====================================================================================================
-- Etapa 2 · E2-M5 — Tareas automáticas: pertenencia ESTRUCTURAL del barbero a la sucursal
--
-- Corrige E2-M2. `barberos_sucursales.disponible` es disponibilidad OPERATIVA (se recalcula solo cada día y
-- solo una fila por barbero puede estar disponible): NO dice si el barbero pertenece a una sucursal. Usarla
-- pausaba y reanudaba las Tareas automáticas de un barbero que trabaja en dos sucursales todos los días.
--
-- Regla nueva: una Tarea automática individual sigue válida mientras exista alguna asignación VIGENTE del par
-- (organización, barbero, sucursal) en `barberos_sucursales`:
--   * principal   → cuenta mientras exista la fila;
--   * recurrente  → cuenta mientras exista la fila (no depende del día de la semana de hoy);
--   * temporal    → cuenta solo entre `fecha_inicio` (NULL = ya empezó) y `fecha_fin`, según el "hoy" de la
--                   organización (`_tareas_auto_hoy`, la misma semántica temporal del motor). Una temporal
--                   futura todavía no cuenta y una vencida deja de contar aunque la fila histórica siga ahí.
--   * `disponible` se ignora por completo.
-- Si no queda ninguna asignación vigente se pausa con el motivo `barbero_sin_asignacion` (antes
-- `barbero_no_disponible`); si vuelve a haber una, se reanuda SOLO si la pausa fue automática.
--
-- Qué hace:
--   * Reemplaza `_tareas_auto_motivo_pausa` y `trg_tareas_recurrentes_prepare` (este último solo en el texto
--     de un error).
--   * Renombra el motivo y su CHECK; migra filas con el valor viejo (si las hubiera).
--   * Quita el trigger de `UPDATE OF disponible` y agrega uno para `UPDATE OF organization_id, barbero_id,
--     sucursal_id, tipo, fecha_inicio, fecha_fin` (mover la sucursal principal sincroniza ambos lados).
--   * El paso del tiempo (una temporal que empieza o vence sin ningún UPDATE) lo resuelve la sincronización
--     horaria que ya hace `_tareas_auto_procesar`: demora de hasta una hora, sin un segundo cron.
--
-- No agrega notificaciones. No agrega funciones SECURITY DEFINER. No toca datos de la Etapa 3.
-- =====================================================================================================

DO $preflight$
DECLARE
  v_viejas integer;
BEGIN
  IF to_regprocedure('public._tareas_auto_motivo_pausa(uuid,uuid,text,uuid)') IS NULL
     OR to_regprocedure('public._tareas_auto_reconciliar(uuid,uuid,uuid,timestamptz)') IS NULL
     OR to_regprocedure('public._tareas_auto_hoy(uuid,timestamptz)') IS NULL
     OR to_regprocedure('public.trg_tareas_recurrentes_prepare()') IS NULL THEN
    RAISE EXCEPTION 'E2-M5 abortada: falta E2-M1/E2-M2 (calendario y pausas).';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'barberos_sucursales'
         AND column_name IN ('tipo', 'fecha_inicio', 'fecha_fin', 'organization_id', 'barbero_id', 'sucursal_id')) <> 6 THEN
    RAISE EXCEPTION 'E2-M5 abortada: barberos_sucursales no tiene las columnas esperadas.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.barberos_sucursales WHERE tipo NOT IN ('principal', 'recurrente', 'temporal')) THEN
    RAISE EXCEPTION 'E2-M5 abortada: hay asignaciones con un tipo desconocido.';
  END IF;
  SELECT count(*) INTO v_viejas FROM public.tareas_recurrentes WHERE pausa_motivo = 'barbero_no_disponible';
  RAISE NOTICE 'E2-M5 preflight: % tareas automáticas con el motivo anterior (se migran a barbero_sin_asignacion).', v_viejas;
END
$preflight$;

-- -----------------------------------------------------------------------------------------------------
-- 1) Motivo y CHECK
-- -----------------------------------------------------------------------------------------------------
ALTER TABLE public.tareas_recurrentes DROP CONSTRAINT IF EXISTS tareas_recurrentes_pausa_motivo_check;

UPDATE public.tareas_recurrentes
   SET pausa_motivo = 'barbero_sin_asignacion'
 WHERE pausa_motivo = 'barbero_no_disponible';

ALTER TABLE public.tareas_recurrentes
  ADD CONSTRAINT tareas_recurrentes_pausa_motivo_check
  CHECK (pausa_motivo IS NULL OR pausa_motivo IN ('manual','sucursal_inactiva','barbero_inactivo','barbero_sin_asignacion')) NOT VALID;

COMMENT ON COLUMN public.tareas_recurrentes.pausa_motivo IS
  'NULL = activa. manual | sucursal_inactiva | barbero_inactivo | barbero_sin_asignacion (sin asignación vigente a la sucursal). activo = (pausa_motivo IS NULL).';

-- -----------------------------------------------------------------------------------------------------
-- 2) Motivo de pausa: pertenencia estructural (ignora `disponible`).
--    Prioridad: sucursal inactiva > persona inactiva > sin asignación vigente. Solo mira la organización indicada.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tareas_auto_motivo_pausa(
  p_org uuid,
  p_sucursal uuid,
  p_scope text,
  p_barbero uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $fn$
DECLARE
  v_hoy date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sucursales s
                  WHERE s.id = p_sucursal
                    AND s.organization_id = p_org
                    AND s.activa
                    AND s.deleted_at IS NULL) THEN
    RETURN 'sucursal_inactiva';
  END IF;

  IF p_scope = 'individual' THEN
    IF p_barbero IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.barberos b
                       WHERE b.id = p_barbero
                         AND b.organization_id = p_org
                         AND b.activo) THEN
      RETURN 'barbero_inactivo';
    END IF;

    v_hoy := public._tareas_auto_hoy(p_org);
    IF NOT EXISTS (SELECT 1 FROM public.barberos_sucursales bs
                    WHERE bs.organization_id = p_org
                      AND bs.barbero_id = p_barbero
                      AND bs.sucursal_id = p_sucursal
                      AND (bs.tipo IN ('principal', 'recurrente')
                           OR (bs.tipo = 'temporal'
                               AND (bs.fecha_inicio IS NULL OR bs.fecha_inicio <= v_hoy)
                               AND bs.fecha_fin >= v_hoy))) THEN
      RETURN 'barbero_sin_asignacion';
    END IF;
  END IF;

  RETURN NULL;
END
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- 3) Trigger de preparación: igual que en E2-M2, con el texto de error del motivo nuevo.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_tareas_recurrentes_prepare()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  -- Escritura de una persona autenticada (cliente). Las escrituras internas (motor, sincronización de
  -- pausas) y las del cron/service_role no pasan por las restricciones de cliente.
  v_client  boolean := (auth.uid() IS NOT NULL
                        AND COALESCE(pg_catalog.current_setting('vittro.tareas_auto', true), '') <> 'on');
  v_hoy     date;
  v_new     record;
  v_old     record;
  v_cambio  boolean := false;
  v_reanuda boolean := false;
  v_motivo  text;
  v_proxima date;
BEGIN
  -- 1) La organización nunca cambia.
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'No se puede cambiar la organización de una tarea automática.' USING ERRCODE = '42501';
  END IF;

  -- 2) Normalizar la programación (solo `custom` usa frecuencia/intervalo/días).
  IF NEW.repeat_preset IS DISTINCT FROM 'custom' THEN
    NEW.repeat_frequency := NULL;
    NEW.repeat_interval := NULL;
    NEW.repeat_byweekday := NULL;
  ELSE
    NEW.repeat_interval := COALESCE(NEW.repeat_interval, 1);
    IF NEW.repeat_frequency IS DISTINCT FROM 'weekly'
       OR NEW.repeat_byweekday IS NULL
       OR cardinality(NEW.repeat_byweekday) = 0 THEN
      NEW.repeat_byweekday := NULL;
    ELSE
      NEW.repeat_byweekday := ARRAY(SELECT DISTINCT d FROM unnest(NEW.repeat_byweekday) d ORDER BY d);
    END IF;
  END IF;

  -- 3) Aislamiento y consistencia de la sucursal y la persona asignada.
  IF TG_OP = 'INSERT'
     OR NEW.sucursal_id IS DISTINCT FROM OLD.sucursal_id
     OR NEW.asignado_a IS DISTINCT FROM OLD.asignado_a
     OR NEW.assignment_scope IS DISTINCT FROM OLD.assignment_scope THEN
    IF NOT EXISTS (SELECT 1 FROM public.sucursales s
                    WHERE s.id = NEW.sucursal_id AND s.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'La sucursal no pertenece a esta organización.' USING ERRCODE = '42501';
    END IF;
    IF NEW.assignment_scope = 'team' THEN
      NEW.asignado_a := NULL;
    ELSIF NEW.asignado_a IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.barberos b
                      WHERE b.id = NEW.asignado_a AND b.organization_id = NEW.organization_id) THEN
        RAISE EXCEPTION 'La persona asignada no pertenece a esta organización.' USING ERRCODE = '42501';
      END IF;
    ELSIF TG_OP = 'INSERT' AND v_client THEN
      RAISE EXCEPTION 'Elegí una persona para una tarea automática individual.' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 4) Programación: válida, y ¿cambió? (se compara la regla ya normalizada, no el texto crudo).
  SELECT * INTO v_new FROM public._tareas_auto_regla(
    NEW.fecha_inicio, NEW.repeat_preset, NEW.repeat_frequency, NEW.repeat_interval, NEW.repeat_byweekday);
  IF TG_OP = 'UPDATE' THEN
    SELECT * INTO v_old FROM public._tareas_auto_regla(
      OLD.fecha_inicio, OLD.repeat_preset, OLD.repeat_frequency, OLD.repeat_interval, OLD.repeat_byweekday);
    v_cambio := NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
             OR v_new.unidad IS DISTINCT FROM v_old.unidad
             OR v_new.paso   IS DISTINCT FROM v_old.paso
             OR v_new.dias   IS DISTINCT FROM v_old.dias;
  END IF;
  IF v_new.unidad IS NULL AND (TG_OP = 'INSERT' OR v_cambio OR v_client) THEN
    RAISE EXCEPTION 'La repetición de la tarea automática no es válida.' USING ERRCODE = '22023';
  END IF;

  -- 5) Campos que un cliente no puede escribir.
  IF v_client THEN
    IF TG_OP = 'INSERT' THEN
      NEW.pausa_motivo := NULL;
      NEW.pausada_at := NULL;
      NEW.recuperacion_at := NULL;
      NEW.recuperacion_fecha := NULL;
      NEW.recuperacion_tipo := NULL;
      NEW.recuperaciones := 0;
    ELSE
      NEW.pausa_motivo := OLD.pausa_motivo;
      NEW.pausada_at := OLD.pausada_at;
      NEW.recuperacion_at := OLD.recuperacion_at;
      NEW.recuperacion_fecha := OLD.recuperacion_fecha;
      NEW.recuperacion_tipo := OLD.recuperacion_tipo;
      NEW.recuperaciones := OLD.recuperaciones;
    END IF;
  END IF;

  -- 6) Pausar / reanudar con `activo`.
  IF TG_OP = 'UPDATE'
     AND NEW.activo IS DISTINCT FROM OLD.activo
     AND NEW.pausa_motivo IS NOT DISTINCT FROM OLD.pausa_motivo THEN
    IF NEW.activo THEN
      v_motivo := public._tareas_auto_motivo_pausa(NEW.organization_id, NEW.sucursal_id, NEW.assignment_scope, NEW.asignado_a);
      IF v_motivo IS NOT NULL THEN
        RAISE EXCEPTION '%', CASE v_motivo
          WHEN 'sucursal_inactiva' THEN 'No se puede reanudar: la sucursal está inactiva. Reactivala primero.'
          WHEN 'barbero_inactivo' THEN 'No se puede reanudar: la persona asignada está inactiva. Asigná a otra persona o reactivala.'
          ELSE 'No se puede reanudar ahora: la persona asignada no tiene una asignación vigente en esta sucursal. Se reanudará sola cuando vuelva a tenerla.'
        END USING ERRCODE = '55000';
      END IF;
      NEW.pausa_motivo := NULL;
      NEW.pausada_at := NULL;
      v_reanuda := true;
    ELSE
      NEW.pausa_motivo := 'manual';
      NEW.pausada_at := pg_catalog.now();
    END IF;
  END IF;

  -- 7) Estado inicial según los recursos (alta). Un cliente no puede crearla sobre una sucursal o una
  --    persona inactivas; si la persona no tiene una asignación vigente en esa sucursal, se crea pausada.
  IF TG_OP = 'INSERT' THEN
    IF NEW.activo THEN
      v_motivo := public._tareas_auto_motivo_pausa(NEW.organization_id, NEW.sucursal_id, NEW.assignment_scope, NEW.asignado_a);
      IF v_motivo IS NOT NULL THEN
        IF v_client AND v_motivo = 'sucursal_inactiva' THEN
          RAISE EXCEPTION 'No se puede crear la tarea automática: la sucursal está inactiva.' USING ERRCODE = '55000';
        ELSIF v_client AND v_motivo = 'barbero_inactivo' THEN
          RAISE EXCEPTION 'No se puede crear la tarea automática: la persona asignada está inactiva.' USING ERRCODE = '55000';
        END IF;
        NEW.activo := false;
        NEW.pausa_motivo := v_motivo;
        NEW.pausada_at := pg_catalog.now();
      END IF;
    ELSIF NEW.pausa_motivo IS NULL THEN
      NEW.pausa_motivo := 'manual';
      NEW.pausada_at := pg_catalog.now();
    END IF;
  ELSIF NEW.activo AND NEW.assignment_scope = 'individual' AND NEW.asignado_a IS NULL THEN
    -- La persona asignada ya no existe (p. ej. la fila se borró): no puede generar tareas.
    NEW.activo := false;
    NEW.pausa_motivo := 'barbero_inactivo';
    NEW.pausada_at := pg_catalog.now();
  END IF;

  -- 8) `proxima_fecha` la fija el servidor, y solo se recalcula si cambió la programación o al reanudar.
  IF TG_OP = 'INSERT' OR v_cambio OR v_reanuda THEN
    v_hoy := public._tareas_auto_hoy(NEW.organization_id);
    v_proxima := public._tareas_auto_siguiente(
      NEW.fecha_inicio, NEW.repeat_preset, NEW.repeat_frequency, NEW.repeat_interval, NEW.repeat_byweekday,
      GREATEST(NEW.fecha_inicio, v_hoy) - 1);
    IF v_proxima IS NOT NULL THEN
      NEW.proxima_fecha := v_proxima;
    END IF;
  ELSIF v_client THEN
    NEW.proxima_fecha := OLD.proxima_fecha;
  END IF;

  -- 9) Invariante: activa ⇔ sin motivo de pausa.
  IF NEW.pausa_motivo IS NULL AND NOT NEW.activo THEN
    NEW.pausa_motivo := 'manual';
  ELSIF NEW.pausa_motivo IS NOT NULL AND NEW.activo THEN
    NEW.activo := false;
  END IF;
  IF NEW.pausa_motivo IS NULL THEN
    NEW.pausada_at := NULL;
  ELSIF NEW.pausada_at IS NULL THEN
    NEW.pausada_at := pg_catalog.now();
  END IF;

  RETURN NEW;
END
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- 4) Sincronización con `barberos_sucursales`: alta, baja y cambios ESTRUCTURALES (no `disponible`).
--    Si cambia el par (organización, barbero, sucursal) se sincronizan el lado viejo y el nuevo.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_tareas_auto_sync_barberos_sucursales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._tareas_auto_reconciliar(OLD.organization_id, OLD.sucursal_id, OLD.barbero_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF ROW(OLD.organization_id, OLD.sucursal_id, OLD.barbero_id) IS DISTINCT FROM ROW(NEW.organization_id, NEW.sucursal_id, NEW.barbero_id) THEN
      PERFORM public._tareas_auto_reconciliar(OLD.organization_id, OLD.sucursal_id, OLD.barbero_id);
    END IF;
    PERFORM public._tareas_auto_reconciliar(NEW.organization_id, NEW.sucursal_id, NEW.barbero_id);
  ELSE
    PERFORM public._tareas_auto_reconciliar(NEW.organization_id, NEW.sucursal_id, NEW.barbero_id);
  END IF;
  RETURN NULL;
END
$fn$;

DROP TRIGGER IF EXISTS trg_tareas_auto_sync_upd ON public.barberos_sucursales;
CREATE TRIGGER trg_tareas_auto_sync_upd
  AFTER UPDATE OF organization_id, barbero_id, sucursal_id, tipo, fecha_inicio, fecha_fin ON public.barberos_sucursales
  FOR EACH ROW WHEN (
    OLD.organization_id IS DISTINCT FROM NEW.organization_id
    OR OLD.barbero_id IS DISTINCT FROM NEW.barbero_id
    OR OLD.sucursal_id IS DISTINCT FROM NEW.sucursal_id
    OR OLD.tipo IS DISTINCT FROM NEW.tipo
    OR OLD.fecha_inicio IS DISTINCT FROM NEW.fecha_inicio
    OR OLD.fecha_fin IS DISTINCT FROM NEW.fecha_fin)
  EXECUTE FUNCTION public.trg_tareas_auto_sync_barberos_sucursales();

-- -----------------------------------------------------------------------------------------------------
-- 5) Permisos y verificación (las funciones reemplazadas conservan sus permisos cerrados)
-- -----------------------------------------------------------------------------------------------------
DO $grants$
DECLARE
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public._tareas_auto_motivo_pausa(uuid,uuid,text,uuid)',
    'public.trg_tareas_recurrentes_prepare()',
    'public.trg_tareas_auto_sync_barberos_sucursales()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', v_sig);
    IF has_function_privilege('anon', to_regprocedure(v_sig), 'EXECUTE')
       OR has_function_privilege('authenticated', to_regprocedure(v_sig), 'EXECUTE')
       OR has_function_privilege('service_role', to_regprocedure(v_sig), 'EXECUTE') THEN
      RAISE EXCEPTION 'E2-M5 abortada: una función interna quedó ejecutable por un rol de cliente.';
    END IF;
  END LOOP;
  IF pg_get_functiondef(to_regprocedure('public._tareas_auto_motivo_pausa(uuid,uuid,text,uuid)')) ILIKE '%disponible%' THEN
    RAISE EXCEPTION 'E2-M5 abortada: la regla de pausa todavía consulta disponible.';
  END IF;
END
$grants$;

DO $validate$
BEGIN
  ALTER TABLE public.tareas_recurrentes VALIDATE CONSTRAINT tareas_recurrentes_pausa_motivo_check;
  RAISE NOTICE 'E2-M5: restricción tareas_recurrentes_pausa_motivo_check validada.';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'E2-M5: tareas_recurrentes_pausa_motivo_check queda NOT VALID (hay filas con otro motivo; no se modifican).';
END
$validate$;
