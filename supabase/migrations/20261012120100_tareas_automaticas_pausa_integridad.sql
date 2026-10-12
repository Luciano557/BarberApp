-- =====================================================================================================
-- Etapa 2 · E2-M2 — Tareas automáticas: pausa (manual y automática), integridad y recuperación
--
-- Qué hace:
--   * Agrega a `tareas_recurrentes` el motivo de la pausa (`pausa_motivo`, `pausada_at`) y la
--     trazabilidad de la recuperación excepcional del motor (`recuperacion_*`).
--   * Un trigger BEFORE INSERT/UPDATE (`trg_tareas_recurrentes_prepare`):
--       - normaliza y valida la programación;
--       - valida que la sucursal y la persona asignada sean de la MISMA organización;
--       - fija `proxima_fecha` en el servidor (solo se recalcula si cambia la programación o al reanudar:
--         editar título/descripción/hora/asignación NO la mueve);
--       - impide que un cliente escriba motivos automáticos, `proxima_fecha` o la trazabilidad;
--       - una pausa hecha por una persona queda como 'manual'; reanudar a mano con el recurso inactivo
--         se rechaza con un mensaje claro.
--   * Triggers AFTER sobre `barberos` (activo), `sucursales` (activa / deleted_at) y
--     `barberos_sucursales` (disponible, alta y baja) que PAUSAN las Tareas automáticas afectadas y
--     REANUDAN solo las que estaban pausadas automáticamente y cuya causa desapareció.
--     Una pausa manual nunca se reanuda sola ni la pisa una pausa automática.
--   * CHECKs de programación y de pausa: se agregan NOT VALID y se validan solo si no hay filas que
--     los violen (las filas históricas no se modifican).
--
-- Seguridad:
--   * Las funciones de trigger son SECURITY DEFINER (quien desactiva a un barbero o a una sucursal
--     puede no tener UPDATE sobre las Tareas automáticas), `search_path = ''`, nombres calificados,
--     y filtran SIEMPRE por organization_id. Ninguna es ejecutable por un rol de cliente.
--   * Las funciones auxiliares son SECURITY INVOKER y también están cerradas a los clientes.
--
-- No hace saneamiento histórico (eso es la Etapa 3): el único dato que escribe es `pausa_motivo` en
-- las Tareas automáticas que YA estaban pausadas, para que cumplan la nueva regla `activo ⇔ sin motivo`.
-- =====================================================================================================

DO $preflight$
DECLARE
  v_org_suc  integer;
  v_org_barb integer;
  v_pausadas integer;
BEGIN
  IF to_regprocedure('public._tareas_auto_siguiente(date,text,text,integer,integer[],date)') IS NULL
     OR to_regprocedure('public._tareas_auto_hoy(uuid,timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'E2-M2 abortada: falta E2-M1 (calendario canónico).';
  END IF;
  IF to_regprocedure('public._notif_org_admins(uuid)') IS NULL
     OR to_regprocedure('public._notif_sucursal_managers(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'E2-M2 abortada: faltan los helpers de notificaciones (Etapa 1).';
  END IF;
  IF to_regclass('public.barberos_sucursales') IS NULL OR to_regclass('public.sucursales') IS NULL OR to_regclass('public.barberos') IS NULL THEN
    RAISE EXCEPTION 'E2-M2 abortada: faltan tablas de equipo/sucursales.';
  END IF;

  -- Aislamiento: una Tarea automática no puede apuntar a una sucursal ni a una persona de otra organización.
  SELECT count(*) INTO v_org_suc
    FROM public.tareas_recurrentes r
    JOIN public.sucursales s ON s.id = r.sucursal_id
   WHERE s.organization_id <> r.organization_id;
  SELECT count(*) INTO v_org_barb
    FROM public.tareas_recurrentes r
    JOIN public.barberos b ON b.id = r.asignado_a
   WHERE b.organization_id IS DISTINCT FROM r.organization_id;
  IF v_org_suc > 0 OR v_org_barb > 0 THEN
    RAISE EXCEPTION 'E2-M2 abortada: % tareas automáticas con sucursal y % con persona asignada de otra organización. Revisar antes de continuar.', v_org_suc, v_org_barb;
  END IF;

  SELECT count(*) INTO v_pausadas FROM public.tareas_recurrentes WHERE activo = false;
  RAISE NOTICE 'E2-M2 preflight: % tareas automáticas ya pausadas (quedarán con motivo manual).', v_pausadas;
END
$preflight$;

-- -----------------------------------------------------------------------------------------------------
-- 1) Columnas
-- -----------------------------------------------------------------------------------------------------
ALTER TABLE public.tareas_recurrentes
  ADD COLUMN IF NOT EXISTS pausa_motivo text,
  ADD COLUMN IF NOT EXISTS pausada_at timestamptz,
  ADD COLUMN IF NOT EXISTS recuperacion_at timestamptz,
  ADD COLUMN IF NOT EXISTS recuperacion_fecha date,
  ADD COLUMN IF NOT EXISTS recuperacion_tipo text,
  ADD COLUMN IF NOT EXISTS recuperaciones integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tareas_recurrentes.pausa_motivo IS
  'NULL = activa. manual | sucursal_inactiva | barbero_inactivo | barbero_no_disponible. activo = (pausa_motivo IS NULL).';
COMMENT ON COLUMN public.tareas_recurrentes.recuperacion_tipo IS
  'Última recuperación excepcional del motor: omitida (la ocurrencia ya habría nacido vencida y se saltó) | tardia (se generó con atraso).';
COMMENT ON COLUMN public.tareas_recurrentes.recuperaciones IS
  'Cantidad acumulada de recuperaciones excepcionales. Un valor que crece indica que el motor está fallando.';

-- Las ya pausadas pasan a "manual" (nadie las pausó automáticamente: no existía esa función).
UPDATE public.tareas_recurrentes
   SET pausa_motivo = 'manual',
       pausada_at   = COALESCE(pausada_at, updated_at, now())
 WHERE activo = false AND pausa_motivo IS NULL;

-- -----------------------------------------------------------------------------------------------------
-- 2) Restricciones (NOT VALID; se validan al final si no hay violaciones)
-- -----------------------------------------------------------------------------------------------------
ALTER TABLE public.tareas_recurrentes
  DROP CONSTRAINT IF EXISTS tareas_recurrentes_pausa_motivo_check,
  DROP CONSTRAINT IF EXISTS tareas_recurrentes_activo_pausa_check,
  DROP CONSTRAINT IF EXISTS tareas_recurrentes_recuperacion_tipo_check,
  DROP CONSTRAINT IF EXISTS tareas_recurrentes_repeat_preset_check,
  DROP CONSTRAINT IF EXISTS tareas_recurrentes_repeat_interval_check,
  DROP CONSTRAINT IF EXISTS tareas_recurrentes_repeat_custom_check,
  DROP CONSTRAINT IF EXISTS tareas_recurrentes_repeat_byweekday_check;

ALTER TABLE public.tareas_recurrentes
  ADD CONSTRAINT tareas_recurrentes_pausa_motivo_check
    CHECK (pausa_motivo IS NULL OR pausa_motivo IN ('manual','sucursal_inactiva','barbero_inactivo','barbero_no_disponible')) NOT VALID,
  ADD CONSTRAINT tareas_recurrentes_activo_pausa_check
    CHECK (activo = (pausa_motivo IS NULL)) NOT VALID,
  ADD CONSTRAINT tareas_recurrentes_recuperacion_tipo_check
    CHECK (recuperacion_tipo IS NULL OR recuperacion_tipo IN ('omitida','tardia')) NOT VALID,
  ADD CONSTRAINT tareas_recurrentes_repeat_preset_check
    CHECK (repeat_preset IN ('daily','weekdays','weekends','weekly','biweekly','monthly','quarterly','semiannual','yearly','custom')) NOT VALID,
  ADD CONSTRAINT tareas_recurrentes_repeat_interval_check
    CHECK (repeat_interval IS NULL OR repeat_interval BETWEEN 1 AND 99) NOT VALID,
  ADD CONSTRAINT tareas_recurrentes_repeat_custom_check
    CHECK (repeat_preset <> 'custom' OR (repeat_frequency IS NOT NULL AND repeat_frequency IN ('daily','weekly','monthly','yearly'))) NOT VALID,
  ADD CONSTRAINT tareas_recurrentes_repeat_byweekday_check
    CHECK (repeat_byweekday IS NULL
           OR (cardinality(repeat_byweekday) BETWEEN 1 AND 7
               AND repeat_byweekday <@ ARRAY[0,1,2,3,4,5,6]
               AND repeat_preset = 'custom'
               AND repeat_frequency = 'weekly')) NOT VALID;

-- -----------------------------------------------------------------------------------------------------
-- 3) Motivo por el que una Tarea automática NO debería generar (NULL = puede generar).
--    Prioridad: sucursal inactiva > persona inactiva > persona no disponible en la sucursal.
--    Solo mira la organización indicada (aislamiento).
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
    IF NOT EXISTS (SELECT 1 FROM public.barberos_sucursales bs
                    WHERE bs.organization_id = p_org
                      AND bs.barbero_id = p_barbero
                      AND bs.sucursal_id = p_sucursal
                      AND bs.disponible) THEN
      RETURN 'barbero_no_disponible';
    END IF;
  END IF;

  RETURN NULL;
END
$fn$;

-- Aviso a dueños/administradores generales y encargados de la sucursal cuando una pausa AUTOMÁTICA
-- estructural (sucursal o persona inactiva) frena una Tarea automática. La indisponibilidad diaria
-- de un barbero que rota entre sucursales NO avisa (ocurre todos los días).
CREATE OR REPLACE FUNCTION public._tareas_auto_notificar_pausa(
  p_receta uuid,
  p_org uuid,
  p_sucursal uuid,
  p_titulo text,
  p_motivo text,
  p_now timestamptz
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  v_recipients uuid[];
  v_cuerpo text;
BEGIN
  IF p_motivo IS NULL OR p_motivo NOT IN ('sucursal_inactiva', 'barbero_inactivo') THEN
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT u) INTO v_recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(p_org) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(p_org, p_sucursal) AS user_id
  ) s;

  v_cuerpo := CASE p_motivo
    WHEN 'sucursal_inactiva' THEN 'Se pausó porque la sucursal se desactivó.'
    ELSE 'Se pausó porque la persona asignada dejó de estar activa.'
  END;

  PERFORM public._notif_emit(
    p_org, 'tarea_automatica_pausada',
    'tarea_auto:' || p_receta::text || ':pausa:' || (EXTRACT(epoch FROM p_now))::bigint::text,
    p_sucursal, 'tareas', 'tareas_recurrentes', p_receta,
    p_titulo, v_cuerpo, NULL, 'actividad_operativa',
    pg_catalog.jsonb_build_object('motivo', p_motivo),
    NULL, NULL,
    v_recipients, true
  );
END
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- 4) Sincronización de pausas: pausa las que deben pausarse y reanuda SOLO las pausadas
--    automáticamente cuya causa ya no existe. Nunca toca una pausa manual. Idempotente.
--    Devuelve la cantidad de Tareas automáticas que cambiaron.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tareas_auto_reconciliar(
  p_org uuid,
  p_sucursal uuid DEFAULT NULL,
  p_barbero uuid DEFAULT NULL,
  p_now timestamptz DEFAULT pg_catalog.now()
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  r record;
  v_motivo text;
  v_hoy date;
  v_proxima date;
  v_cambios integer := 0;
  v_prev text := COALESCE(pg_catalog.current_setting('vittro.tareas_auto', true), '');
BEGIN
  IF p_org IS NULL THEN
    RETURN 0;
  END IF;

  -- Marca interna: el trigger de preparación deja pasar estas escrituras (no son del cliente).
  PERFORM pg_catalog.set_config('vittro.tareas_auto', 'on', true);

  FOR r IN
    SELECT *
      FROM public.tareas_recurrentes t
     WHERE t.organization_id = p_org
       AND (p_sucursal IS NULL OR t.sucursal_id = p_sucursal)
       AND (p_barbero IS NULL OR t.asignado_a = p_barbero)
       AND t.pausa_motivo IS DISTINCT FROM 'manual'
     ORDER BY t.id
       FOR UPDATE
  LOOP
    BEGIN
      v_motivo := public._tareas_auto_motivo_pausa(r.organization_id, r.sucursal_id, r.assignment_scope, r.asignado_a);

      IF v_motivo IS NOT DISTINCT FROM r.pausa_motivo THEN
        CONTINUE;
      END IF;

      IF v_motivo IS NULL THEN
        -- Reanudar: la causa desapareció. Desde hoy; no se genera lo atrasado.
        v_hoy := public._tareas_auto_hoy(r.organization_id, p_now);
        v_proxima := public._tareas_auto_siguiente(
          r.fecha_inicio, r.repeat_preset, r.repeat_frequency, r.repeat_interval, r.repeat_byweekday,
          GREATEST(r.fecha_inicio, v_hoy) - 1);
        IF v_proxima IS NULL THEN
          -- Programación inválida (dato histórico): se queda pausada hasta que alguien la corrija.
          CONTINUE;
        END IF;
        UPDATE public.tareas_recurrentes
           SET activo = true, pausa_motivo = NULL, pausada_at = NULL, proxima_fecha = v_proxima
         WHERE id = r.id;
      ELSE
        UPDATE public.tareas_recurrentes
           SET activo = false, pausa_motivo = v_motivo, pausada_at = COALESCE(r.pausada_at, p_now)
         WHERE id = r.id;
        IF r.activo THEN
          BEGIN
            PERFORM public._tareas_auto_notificar_pausa(r.id, r.organization_id, r.sucursal_id, r.titulo, v_motivo, p_now);
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'tareas_auto: no se pudo avisar la pausa de la tarea automática % (organización %)', r.id, r.organization_id;
          END;
        END IF;
      END IF;
      v_cambios := v_cambios + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Una Tarea automática defectuosa no debe impedir la acción del usuario ni procesar las demás.
      RAISE WARNING 'tareas_auto: no se pudo sincronizar la tarea automática % (organización %)', r.id, r.organization_id;
    END;
  END LOOP;

  PERFORM pg_catalog.set_config('vittro.tareas_auto', v_prev, true);
  RETURN v_cambios;
END
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- 5) Trigger de preparación de la receta (alta y edición)
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
          ELSE 'No se puede reanudar ahora: la persona asignada no está disponible en esta sucursal. Se reanudará sola cuando vuelva a estarlo.'
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
  --    persona inactivas; si la persona solo está "no disponible hoy" en esa sucursal, se crea pausada.
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

DROP TRIGGER IF EXISTS trg_tareas_recurrentes_prepare ON public.tareas_recurrentes;
CREATE TRIGGER trg_tareas_recurrentes_prepare
  BEFORE INSERT OR UPDATE ON public.tareas_recurrentes
  FOR EACH ROW EXECUTE FUNCTION public.trg_tareas_recurrentes_prepare();

-- -----------------------------------------------------------------------------------------------------
-- 6) Triggers de sincronización de pausas sobre persona, sucursal y disponibilidad
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_tareas_auto_sync_barberos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    PERFORM public._tareas_auto_reconciliar(NEW.organization_id, NULL, NEW.id);
  END IF;
  RETURN NULL;
END
$fn$;

CREATE OR REPLACE FUNCTION public.trg_tareas_auto_sync_sucursales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  PERFORM public._tareas_auto_reconciliar(NEW.organization_id, NEW.id, NULL);
  RETURN NULL;
END
$fn$;

CREATE OR REPLACE FUNCTION public.trg_tareas_auto_sync_barberos_sucursales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._tareas_auto_reconciliar(OLD.organization_id, OLD.sucursal_id, OLD.barbero_id);
  ELSE
    PERFORM public._tareas_auto_reconciliar(NEW.organization_id, NEW.sucursal_id, NEW.barbero_id);
  END IF;
  RETURN NULL;
END
$fn$;

DROP TRIGGER IF EXISTS trg_tareas_auto_sync ON public.barberos;
CREATE TRIGGER trg_tareas_auto_sync
  AFTER UPDATE OF activo ON public.barberos
  FOR EACH ROW WHEN (OLD.activo IS DISTINCT FROM NEW.activo)
  EXECUTE FUNCTION public.trg_tareas_auto_sync_barberos();

DROP TRIGGER IF EXISTS trg_tareas_auto_sync ON public.sucursales;
CREATE TRIGGER trg_tareas_auto_sync
  AFTER UPDATE OF activa, deleted_at ON public.sucursales
  FOR EACH ROW WHEN (OLD.activa IS DISTINCT FROM NEW.activa OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
  EXECUTE FUNCTION public.trg_tareas_auto_sync_sucursales();

DROP TRIGGER IF EXISTS trg_tareas_auto_sync_ins ON public.barberos_sucursales;
CREATE TRIGGER trg_tareas_auto_sync_ins
  AFTER INSERT ON public.barberos_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.trg_tareas_auto_sync_barberos_sucursales();

DROP TRIGGER IF EXISTS trg_tareas_auto_sync_upd ON public.barberos_sucursales;
CREATE TRIGGER trg_tareas_auto_sync_upd
  AFTER UPDATE OF disponible ON public.barberos_sucursales
  FOR EACH ROW WHEN (OLD.disponible IS DISTINCT FROM NEW.disponible)
  EXECUTE FUNCTION public.trg_tareas_auto_sync_barberos_sucursales();

DROP TRIGGER IF EXISTS trg_tareas_auto_sync_del ON public.barberos_sucursales;
CREATE TRIGGER trg_tareas_auto_sync_del
  AFTER DELETE ON public.barberos_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.trg_tareas_auto_sync_barberos_sucursales();

-- -----------------------------------------------------------------------------------------------------
-- 7) Permisos y verificación
-- -----------------------------------------------------------------------------------------------------
DO $grants$
DECLARE
  v_sig text;
  v_sigs text[] := ARRAY[
    'public._tareas_auto_motivo_pausa(uuid,uuid,text,uuid)',
    'public._tareas_auto_notificar_pausa(uuid,uuid,uuid,text,text,timestamptz)',
    'public._tareas_auto_reconciliar(uuid,uuid,uuid,timestamptz)',
    'public.trg_tareas_recurrentes_prepare()',
    'public.trg_tareas_auto_sync_barberos()',
    'public.trg_tareas_auto_sync_sucursales()',
    'public.trg_tareas_auto_sync_barberos_sucursales()'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', v_sig);
    IF has_function_privilege('anon', to_regprocedure(v_sig), 'EXECUTE')
       OR has_function_privilege('authenticated', to_regprocedure(v_sig), 'EXECUTE')
       OR has_function_privilege('service_role', to_regprocedure(v_sig), 'EXECUTE') THEN
      RAISE EXCEPTION 'E2-M2 abortada: una función interna de pausas quedó ejecutable por un rol de cliente.';
    END IF;
  END LOOP;

  -- Las funciones de trigger SECURITY DEFINER deben tener el mismo dueño que las tablas de notificaciones
  -- (así pueden invocar los helpers cerrados en la Etapa 1).
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid IN (SELECT to_regprocedure(s) FROM unnest(v_sigs) s)
       AND p.proowner <> (SELECT proowner FROM pg_proc WHERE oid = to_regprocedure('public._notif_emit(uuid,text,text,uuid,text,text,uuid,text,text,text,text,jsonb,uuid,text,uuid[],boolean)'))) THEN
    RAISE EXCEPTION 'E2-M2 abortada: las funciones de pausas tienen un dueño distinto del de los helpers de notificaciones.';
  END IF;
END
$grants$;

-- -----------------------------------------------------------------------------------------------------
-- 8) Validar las restricciones solo si ninguna fila las viola (si no, quedan NOT VALID y se informa).
-- -----------------------------------------------------------------------------------------------------
DO $validate$
DECLARE
  v_name text;
  v_names text[] := ARRAY[
    'tareas_recurrentes_pausa_motivo_check', 'tareas_recurrentes_activo_pausa_check',
    'tareas_recurrentes_recuperacion_tipo_check', 'tareas_recurrentes_repeat_preset_check',
    'tareas_recurrentes_repeat_interval_check', 'tareas_recurrentes_repeat_custom_check',
    'tareas_recurrentes_repeat_byweekday_check'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.tareas_recurrentes VALIDATE CONSTRAINT %I', v_name);
      RAISE NOTICE 'E2-M2: restricción % validada.', v_name;
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'E2-M2: la restricción % queda NOT VALID (hay filas históricas que no la cumplen; no se modifican).', v_name;
    END;
  END LOOP;
END
$validate$;
