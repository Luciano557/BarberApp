-- =====================================================================================================
-- Etapa 2 · E2-M3 — Tareas automáticas: motor, destinatarios correctos y vencimientos
--
-- Qué hace:
--   * `_notif_barbero_users`: usuarios (profiles.id) vinculados a un barbero por `profiles.barbero_id`.
--     Un `barberos.id` NUNCA es un id de usuario.
--   * Motor nuevo: `_tareas_auto_generar` (una receta) y `_tareas_auto_procesar(_now)` (todas), con:
--       - "hoy" según `organizations.timezone`;
--       - como máximo UNA ocurrencia por ejecución: la vigente (la última fecha de la serie ≤ hoy);
--       - si esa ocurrencia ya habría nacido vencida se SALTA (nada retroactivo, sin aviso de vencimiento)
--         y se deja trazabilidad en la propia Tarea automática (`recuperacion_*`) y en los logs;
--       - ocurrencias con `tipo = 'tarea'` (nunca 'admin'), `recurrente = false`, sin `repeat_*`;
--       - `INSERT … ON CONFLICT DO NOTHING` sobre `uq_tareas_recurrencia_fecha`, filas bloqueadas con
--         `FOR UPDATE SKIP LOCKED`: un reintento o una ejecución en paralelo no duplican;
--       - antes de generar valida sucursal y persona; si no están disponibles, pausa y no genera;
--       - cada Tarea automática se procesa aislada: una defectuosa no frena a las demás.
--   * `process_tareas_recurrentes()` conserva nombre, firma, permisos y horario del cron; ahora delega.
--   * Al guardar una Tarea automática (alta, edición de programación, reanudación) el servidor genera la
--     ocurrencia de hoy si corresponde (el cliente ya no crea esa tarea).
--   * Corrige las tres funciones que trataban `barberos.id` como identidad de usuario:
--     `trg_tareas_after_insert_notif`, `process_vencimientos_tareas` y
--     `trg_barberos_sucursales_after_disponible_off_notif`.
--   * `process_vencimientos_tareas`: aislamiento por fila y una tarea `en_progreso` también puede quedar
--     vencida (se marca `vencida_at`; el estado sigue siendo `en_progreso`).
--   * Elimina `_calc_next_tarea_date` (reemplazada por el calendario canónico de E2-M1).
--
-- Seguridad:
--   * Se reescriben funciones SECURITY DEFINER con `search_path = ''` y nombres calificados (antes
--     `search_path = public`). Siguen siendo del mismo dueño que los helpers `_notif_*` (se verifica).
--   * Las funciones nuevas están cerradas a anon/authenticated/service_role. Solo
--     `process_tareas_recurrentes()` y `process_vencimientos_tareas()` conservan EXECUTE para
--     service_role, como antes.
--   * No se abre ningún helper ni RPC de la Etapa 1.
-- =====================================================================================================

DO $preflight$
DECLARE
  v_owner oid;
  v_sig text;
BEGIN
  IF to_regprocedure('public._tareas_auto_reconciliar(uuid,uuid,uuid,timestamptz)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'tareas_recurrentes' AND column_name = 'recuperacion_tipo') THEN
    RAISE EXCEPTION 'E2-M3 abortada: falta E2-M2 (pausas e integridad).';
  END IF;

  v_owner := (SELECT proowner FROM pg_proc WHERE oid = to_regprocedure('public._notif_emit(uuid,text,text,uuid,text,text,uuid,text,text,text,text,jsonb,uuid,text,uuid[],boolean)'));
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'E2-M3 abortada: falta el helper _notif_emit (Etapa 1).';
  END IF;
  FOREACH v_sig IN ARRAY ARRAY[
    'public.trg_tareas_after_insert_notif()',
    'public.process_vencimientos_tareas()',
    'public.process_tareas_recurrentes()',
    'public.trg_barberos_sucursales_after_disponible_off_notif()'
  ] LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      RAISE EXCEPTION 'E2-M3 abortada: falta una función existente que esta migración reemplaza.';
    END IF;
    IF (SELECT proowner FROM pg_proc WHERE oid = to_regprocedure(v_sig)) <> v_owner THEN
      RAISE EXCEPTION 'E2-M3 abortada: una función a reemplazar tiene un dueño distinto del de los helpers de notificaciones.';
    END IF;
  END LOOP;

  -- Los trabajos de pg_cron deben seguir corriendo como el dueño de las funciones (si pg_cron existe).
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-tareas-recurrentes') THEN
      RAISE NOTICE 'E2-M3: no existe el job process-tareas-recurrentes; el motor no correrá solo hasta recrearlo.';
    ELSIF EXISTS (SELECT 1 FROM cron.job j WHERE j.jobname IN ('process-tareas-recurrentes', 'process-vencimientos-tareas')
                     AND j.username <> pg_get_userbyid(v_owner)) THEN
      RAISE EXCEPTION 'E2-M3 abortada: un job de tareas corre con un usuario distinto del dueño de las funciones.';
    END IF;
  END IF;
END
$preflight$;

-- -----------------------------------------------------------------------------------------------------
-- 1) Usuarios de un barbero. `profiles.barbero_id → barberos.id`; `profiles.id = auth.users.id`.
--    Puede devolver 0 o varios usuarios. Exige que el barbero pertenezca a la organización.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notif_barbero_users(_org uuid, _barbero_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
  SELECT p.id
    FROM public.profiles p
    JOIN public.barberos b ON b.id = p.barbero_id AND b.organization_id = p.organization_id
   WHERE p.organization_id = _org
     AND p.barbero_id = _barbero_id
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- 2) Generación de la ocurrencia vigente de UNA Tarea automática. Devuelve 1 si creó una tarea.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tareas_auto_generar(p_receta uuid, p_now timestamptz DEFAULT pg_catalog.now())
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  r            public.tareas_recurrentes%ROWTYPE;
  v_hoy        date;
  v_dias       integer;
  v_motivo     text;
  v_vigente    date;
  v_siguiente  date;
  v_nombre     text;
  v_filas      integer := 0;
  v_rec_tipo   text;
  v_rec_fecha  date;
  v_prev       text := COALESCE(pg_catalog.current_setting('vittro.tareas_auto', true), '');
BEGIN
  SELECT * INTO r FROM public.tareas_recurrentes WHERE id = p_receta FOR UPDATE SKIP LOCKED;
  IF NOT FOUND OR NOT r.activo THEN
    RETURN 0;
  END IF;

  v_hoy := public._tareas_auto_hoy(r.organization_id, p_now);
  IF r.proxima_fecha > v_hoy THEN
    RETURN 0;
  END IF;

  -- Marca interna: las escrituras de esta función no son del cliente ni vuelven a disparar la generación.
  PERFORM pg_catalog.set_config('vittro.tareas_auto', 'on', true);

  -- Red de seguridad: sucursal y persona deben estar disponibles. Si no, se pausa y no se genera.
  v_motivo := public._tareas_auto_motivo_pausa(r.organization_id, r.sucursal_id, r.assignment_scope, r.asignado_a);
  IF v_motivo IS NOT NULL THEN
    UPDATE public.tareas_recurrentes
       SET activo = false, pausa_motivo = v_motivo, pausada_at = p_now
     WHERE id = r.id;
    BEGIN
      PERFORM public._tareas_auto_notificar_pausa(r.id, r.organization_id, r.sucursal_id, r.titulo, v_motivo, p_now);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'tareas_auto: no se pudo avisar la pausa de la tarea automática % (organización %)', r.id, r.organization_id;
    END;
    PERFORM pg_catalog.set_config('vittro.tareas_auto', v_prev, true);
    RETURN 0;
  END IF;

  v_vigente := public._tareas_auto_vigente(
    r.fecha_inicio, r.repeat_preset, r.repeat_frequency, r.repeat_interval, r.repeat_byweekday, v_hoy);
  v_siguiente := public._tareas_auto_siguiente(
    r.fecha_inicio, r.repeat_preset, r.repeat_frequency, r.repeat_interval, r.repeat_byweekday, v_hoy);
  IF v_siguiente IS NULL THEN
    RAISE EXCEPTION 'programación inválida en la tarea automática %', r.id;
  END IF;

  -- La ocurrencia vigente es la última fecha de la serie <= hoy, y nunca anterior a `proxima_fecha`
  -- (así no se recrea lo que alguien borró ni se reconstruye lo perdido).
  IF v_vigente IS NOT NULL AND v_vigente >= r.proxima_fecha THEN
    SELECT COALESCE(o.tareas_vencimiento_dias_default, 1) INTO v_dias
      FROM public.organizations o WHERE o.id = r.organization_id;
    v_dias := COALESCE(v_dias, 1);

    IF v_vigente + v_dias < v_hoy THEN
      -- Recuperación excepcional: ya habría nacido vencida. No se crea ni se avisa; se avanza.
      v_rec_tipo := 'omitida';
      v_rec_fecha := r.proxima_fecha;
    ELSE
      IF r.proxima_fecha < v_vigente THEN
        -- Había ocurrencias anteriores sin generar (el motor estuvo detenido): se salta lo perdido.
        v_rec_tipo := 'omitida';
        v_rec_fecha := r.proxima_fecha;
      ELSIF v_vigente < v_hoy THEN
        -- Se genera la ocurrencia perdida porque todavía no habría nacido vencida.
        v_rec_tipo := 'tardia';
        v_rec_fecha := v_vigente;
      END IF;

      IF r.assignment_scope = 'team' THEN
        v_nombre := COALESCE(NULLIF(r.asignado_nombre, ''), 'Todo el equipo');
      ELSE
        v_nombre := NULLIF(r.asignado_nombre, '');
        IF v_nombre IS NULL THEN
          SELECT NULLIF(pg_catalog.btrim(b.nombre || ' ' || COALESCE(b.apellido, '')), '') INTO v_nombre
            FROM public.barberos b
           WHERE b.id = r.asignado_a AND b.organization_id = r.organization_id;
        END IF;
      END IF;

      INSERT INTO public.tareas (
        organization_id, sucursal_id, tipo, titulo, descripcion, estado,
        assignment_scope, asignado_a_id, asignado_a_nombre,
        creado_por_id, creado_por_nombre, hora, fecha_inicio,
        recurrencia_id, recurrente, repeat_preset, repeat_frequency, repeat_interval, repeat_byweekday
      ) VALUES (
        r.organization_id, r.sucursal_id, 'tarea', r.titulo, r.descripcion, 'pendiente',
        r.assignment_scope, r.asignado_a, v_nombre,
        NULL, 'Sistema', r.hora, v_vigente,
        r.id, false, NULL, NULL, NULL, NULL
      )
      ON CONFLICT (recurrencia_id, fecha_inicio) WHERE recurrencia_id IS NOT NULL AND fecha_inicio IS NOT NULL
      DO NOTHING;
      GET DIAGNOSTICS v_filas = ROW_COUNT;
    END IF;
  END IF;

  IF v_rec_tipo IS NOT NULL THEN
    RAISE WARNING 'tareas_auto: recuperación excepcional (%) de la ocurrencia % en la tarea automática % (organización %)',
      v_rec_tipo, v_rec_fecha, r.id, r.organization_id;
  END IF;

  UPDATE public.tareas_recurrentes
     SET proxima_fecha      = v_siguiente,
         recuperacion_at    = CASE WHEN v_rec_tipo IS NOT NULL THEN p_now ELSE recuperacion_at END,
         recuperacion_fecha = CASE WHEN v_rec_tipo IS NOT NULL THEN v_rec_fecha ELSE recuperacion_fecha END,
         recuperacion_tipo  = CASE WHEN v_rec_tipo IS NOT NULL THEN v_rec_tipo ELSE recuperacion_tipo END,
         recuperaciones     = CASE WHEN v_rec_tipo IS NOT NULL THEN recuperaciones + 1 ELSE recuperaciones END
   WHERE id = r.id;

  PERFORM pg_catalog.set_config('vittro.tareas_auto', v_prev, true);
  RETURN v_filas;
END
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- 3) Motor: sincroniza pausas y genera la ocurrencia vigente de cada Tarea automática que corresponda.
--    Cada organización y cada Tarea automática se procesan en su propio sub-bloque: un error no frena
--    a las demás, y el WARNING lleva solo identificadores.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tareas_auto_procesar(p_now timestamptz DEFAULT pg_catalog.now())
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  v_org        uuid;
  r            record;
  v_generadas  integer := 0;
  v_avisadas   uuid[] := ARRAY[]::uuid[];
BEGIN
  -- 1) Pausas: pausa lo que corresponda y reanuda SOLO lo pausado automáticamente cuya causa terminó.
  FOR v_org IN
    SELECT DISTINCT t.organization_id
      FROM public.tareas_recurrentes t
     WHERE t.pausa_motivo IS DISTINCT FROM 'manual'
     ORDER BY 1
  LOOP
    BEGIN
      PERFORM public._tareas_auto_reconciliar(v_org, NULL, NULL, p_now);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'tareas_auto: no se pudieron sincronizar las pausas de la organización %', v_org;
    END;
  END LOOP;

  -- 2) Generación. La cota usa la fecha UTC + 1 (la zona más adelantada); cada receta afina con su "hoy".
  FOR r IN
    SELECT t.id, t.organization_id
      FROM public.tareas_recurrentes t
     WHERE t.activo
       AND t.proxima_fecha <= ((p_now AT TIME ZONE 'UTC')::date + 1)
     ORDER BY t.organization_id, t.proxima_fecha, t.id
  LOOP
    BEGIN
      IF NOT (r.organization_id = ANY (v_avisadas)) THEN
        v_avisadas := v_avisadas || r.organization_id;
        IF NOT public._tareas_auto_tz_valida(r.organization_id) THEN
          RAISE WARNING 'tareas_auto: la organización % no tiene una zona horaria válida; se usa America/Argentina/Buenos_Aires', r.organization_id;
        END IF;
      END IF;
      v_generadas := v_generadas + public._tareas_auto_generar(r.id, p_now);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'tareas_auto: error al procesar la tarea automática % (organización %) [%]', r.id, r.organization_id, SQLSTATE;
    END;
  END LOOP;

  RETURN v_generadas;
END
$fn$;

-- Entrada del cron (nombre, firma, permisos y horario sin cambios).
CREATE OR REPLACE FUNCTION public.process_tareas_recurrentes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  RETURN public._tareas_auto_procesar(pg_catalog.now());
END
$fn$;

COMMENT ON FUNCTION public.process_tareas_recurrentes() IS
  'Motor de Tareas automáticas (cron horario). Delega en _tareas_auto_procesar. Genera tipo=tarea, una ocurrencia vigente por vez, idempotente. Etapa 2.';

-- -----------------------------------------------------------------------------------------------------
-- 4) Al guardar una Tarea automática el servidor genera la ocurrencia de hoy (si corresponde).
--    Nunca bloquea el guardado: si falla, el cron lo reintenta.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_tareas_recurrentes_generar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF pg_catalog.pg_trigger_depth() > 1
     OR COALESCE(pg_catalog.current_setting('vittro.tareas_auto', true), '') = 'on'
     OR NOT NEW.activo THEN
    RETURN NULL;
  END IF;
  IF NEW.proxima_fecha > public._tareas_auto_hoy(NEW.organization_id) THEN
    RETURN NULL;
  END IF;
  BEGIN
    PERFORM public._tareas_auto_generar(NEW.id, pg_catalog.now());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tareas_auto: no se pudo generar al guardar la tarea automática % (organización %) [%]', NEW.id, NEW.organization_id, SQLSTATE;
  END;
  RETURN NULL;
END
$fn$;

DROP TRIGGER IF EXISTS trg_tareas_recurrentes_generar ON public.tareas_recurrentes;
CREATE TRIGGER trg_tareas_recurrentes_generar
  AFTER INSERT OR UPDATE ON public.tareas_recurrentes
  FOR EACH ROW EXECUTE FUNCTION public.trg_tareas_recurrentes_generar();

-- -----------------------------------------------------------------------------------------------------
-- 5) Aviso de tarea asignada: el destinatario individual es el USUARIO del barbero.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_tareas_after_insert_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  _recipients uuid[];
  _is_sa_creator boolean;
BEGIN
  IF NEW.tipo = 'tarea' THEN
    IF NEW.assignment_scope = 'individual' AND NEW.asignado_a_id IS NOT NULL THEN
      -- tarea_asignada
      SELECT array_agg(DISTINCT u) FROM (
        SELECT bu AS u FROM public._notif_barbero_users(NEW.organization_id, NEW.asignado_a_id) AS bu
        UNION SELECT user_id FROM public._notif_org_admins(NEW.organization_id) AS user_id
        UNION SELECT user_id FROM public._notif_sucursal_managers(NEW.organization_id, NEW.sucursal_id) AS user_id
          WHERE NEW.sucursal_id IS NOT NULL
      ) s INTO _recipients;

      PERFORM public._notif_emit(
        NEW.organization_id, 'tarea_asignada',
        'tarea:' || NEW.id::text || ':asignada',
        NEW.sucursal_id, 'tareas', 'tareas', NEW.id,
        NEW.titulo, NEW.descripcion, NULL, 'actividad_operativa',
        jsonb_build_object('asignado_a_nombre', NEW.asignado_a_nombre),
        NEW.creado_por_id, NEW.creado_por_nombre,
        _recipients, true
      );

    ELSIF NEW.assignment_scope = 'team' AND NEW.sucursal_id IS NOT NULL THEN
      -- tarea_equipo_asignada
      SELECT array_agg(DISTINCT u) FROM (
        SELECT user_id AS u FROM public._notif_org_admins(NEW.organization_id) AS user_id
        UNION SELECT user_id FROM public._notif_sucursal_managers(NEW.organization_id, NEW.sucursal_id) AS user_id
        UNION SELECT user_id FROM public._notif_sucursal_barbers(NEW.organization_id, NEW.sucursal_id) AS user_id
        UNION SELECT user_id FROM public._notif_sucursal_account(NEW.organization_id, NEW.sucursal_id) AS user_id
        UNION SELECT NEW.creado_por_id WHERE NEW.creado_por_id IS NOT NULL
      ) s INTO _recipients;

      PERFORM public._notif_emit(
        NEW.organization_id, 'tarea_equipo_asignada',
        'tarea:' || NEW.id::text || ':equipo_asignada',
        NEW.sucursal_id, 'tareas', 'tareas', NEW.id,
        NEW.titulo, NEW.descripcion, NULL, 'actividad_operativa',
        '{}'::jsonb,
        NEW.creado_por_id, NEW.creado_por_nombre,
        _recipients, true
      );
    END IF;

  ELSIF NEW.tipo = 'peticion' THEN
    -- peticion_nueva
    _is_sa_creator := NEW.creado_por_id IS NOT NULL
                  AND public.has_role(NEW.creado_por_id, 'sucursal_account'::public.app_role);

    SELECT array_agg(DISTINCT u) FROM (
      SELECT user_id AS u FROM public._notif_org_admins(NEW.organization_id) AS user_id
      UNION SELECT user_id FROM public._notif_sucursal_managers(NEW.organization_id, NEW.sucursal_id) AS user_id
        WHERE NEW.sucursal_id IS NOT NULL
      UNION SELECT NEW.creado_por_id WHERE _is_sa_creator
    ) s INTO _recipients;

    PERFORM public._notif_emit(
      NEW.organization_id, 'peticion_nueva',
      'peticion:' || NEW.id::text || ':nueva',
      NEW.sucursal_id, 'tareas', 'tareas', NEW.id,
      NEW.titulo, NEW.descripcion, NULL, 'gestion_interna',
      jsonb_build_object('creado_por_nombre', NEW.creado_por_nombre),
      NEW.creado_por_id, NEW.creado_por_nombre,
      _recipients, true
    );
  END IF;

  RETURN NEW;
END
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- 6) Vencimientos: aislamiento por fila, destinatario individual correcto y `en_progreso` también vence.
--    - pendiente  → estado 'vencida' + vencida_at (como antes).
--    - en_progreso → solo vencida_at (el estado sigue siendo en_progreso: "empezada" y "atrasada" son
--      conceptos independientes).
--    "Hoy" y el plazo salen de la zona horaria y de tareas_vencimiento_dias_default de la organización.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_vencimientos_tareas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  _r record;
  _count integer := 0;
  _recipients uuid[];
BEGIN
  -- ---------- TAREAS (pendientes y en progreso) ----------
  FOR _r IN
    WITH org_hoy AS MATERIALIZED (
      SELECT o.id,
             public._tareas_auto_hoy(o.id) AS hoy,
             COALESCE(o.tareas_vencimiento_dias_default, 1) AS dias
        FROM public.organizations o
       WHERE EXISTS (SELECT 1 FROM public.tareas x
                      WHERE x.organization_id = o.id AND x.tipo = 'tarea'
                        AND x.estado IN ('pendiente', 'en_progreso') AND x.fecha_inicio IS NOT NULL)
    )
    SELECT t.*
      FROM public.tareas t
      JOIN org_hoy h ON h.id = t.organization_id
     WHERE t.tipo = 'tarea'
       AND t.fecha_inicio IS NOT NULL
       AND ((t.estado = 'pendiente') OR (t.estado = 'en_progreso' AND t.vencida_at IS NULL))
       AND (t.fecha_inicio + h.dias) < h.hoy
     ORDER BY t.organization_id, t.fecha_inicio, t.id
  LOOP
    BEGIN
      -- Transición atómica: solo procesa si sigue en el mismo estado.
      IF _r.estado = 'pendiente' THEN
        UPDATE public.tareas
           SET estado = 'vencida', vencida_at = COALESCE(vencida_at, now())
         WHERE id = _r.id AND estado = 'pendiente';
      ELSE
        UPDATE public.tareas
           SET vencida_at = now()
         WHERE id = _r.id AND estado = 'en_progreso' AND vencida_at IS NULL;
      END IF;
      IF NOT FOUND THEN CONTINUE; END IF;

      -- Destinatarios (espejo de trg_tareas_after_insert_notif; la persona es el USUARIO del barbero).
      IF _r.assignment_scope = 'individual' AND _r.asignado_a_id IS NOT NULL THEN
        SELECT array_agg(DISTINCT u) FROM (
          SELECT bu AS u FROM public._notif_barbero_users(_r.organization_id, _r.asignado_a_id) AS bu
          UNION SELECT user_id FROM public._notif_org_admins(_r.organization_id) AS user_id
          UNION SELECT user_id FROM public._notif_sucursal_managers(_r.organization_id, _r.sucursal_id) AS user_id
            WHERE _r.sucursal_id IS NOT NULL
        ) s INTO _recipients;
      ELSE
        SELECT array_agg(DISTINCT u) FROM (
          SELECT user_id AS u FROM public._notif_org_admins(_r.organization_id) AS user_id
          UNION SELECT user_id FROM public._notif_sucursal_managers(_r.organization_id, _r.sucursal_id) AS user_id
            WHERE _r.sucursal_id IS NOT NULL
          UNION SELECT user_id FROM public._notif_sucursal_barbers(_r.organization_id, _r.sucursal_id) AS user_id
            WHERE _r.sucursal_id IS NOT NULL
          UNION SELECT user_id FROM public._notif_sucursal_account(_r.organization_id, _r.sucursal_id) AS user_id
            WHERE _r.sucursal_id IS NOT NULL
          UNION SELECT _r.creado_por_id WHERE _r.creado_por_id IS NOT NULL
        ) s INTO _recipients;
      END IF;

      PERFORM public._notif_emit(
        _r.organization_id, 'tarea_vencida',
        'tarea:' || _r.id::text || ':vencida',
        _r.sucursal_id, 'tareas', 'tareas', _r.id,
        _r.titulo, _r.descripcion, NULL, 'actividad_operativa',
        jsonb_build_object(
          'asignado_a_nombre', _r.asignado_a_nombre,
          'fecha_inicio', _r.fecha_inicio,
          'vencio_at', now()
        ),
        NULL, NULL,
        _recipients, true
      );
      _count := _count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'process_vencimientos_tareas: error en la tarea % (organización %) [%]', _r.id, _r.organization_id, SQLSTATE;
    END;
  END LOOP;

  -- ---------- PETICIONES ----------
  -- Vencimiento: created_at + COALESCE(t.vencimiento_dias, org.peticiones_vencimiento_dias, 60) días.
  FOR _r IN
    SELECT t.*
      FROM public.tareas t
      JOIN public.organizations o ON o.id = t.organization_id
     WHERE t.tipo = 'peticion'
       AND t.estado = 'pendiente'
       AND (t.created_at + (COALESCE(t.vencimiento_dias, o.peticiones_vencimiento_dias, 60)::text || ' days')::interval) < now()
     ORDER BY t.organization_id, t.created_at, t.id
  LOOP
    BEGIN
      UPDATE public.tareas
         SET estado = 'vencida', vencida_at = COALESCE(vencida_at, now())
       WHERE id = _r.id AND estado = 'pendiente';
      IF NOT FOUND THEN CONTINUE; END IF;

      SELECT array_agg(DISTINCT u) FROM (
        SELECT _r.creado_por_id AS u WHERE _r.creado_por_id IS NOT NULL
        UNION SELECT user_id FROM public._notif_org_admins(_r.organization_id) AS user_id
        UNION SELECT user_id FROM public._notif_sucursal_managers(_r.organization_id, _r.sucursal_id) AS user_id
          WHERE _r.sucursal_id IS NOT NULL
      ) s INTO _recipients;

      PERFORM public._notif_emit(
        _r.organization_id, 'peticion_vencida',
        'peticion:' || _r.id::text || ':vencida',
        _r.sucursal_id, 'tareas', 'tareas', _r.id,
        _r.titulo, _r.descripcion, NULL, 'gestion_interna',
        jsonb_build_object(
          'creado_por_nombre', _r.creado_por_nombre,
          'vencio_at', now()
        ),
        NULL, NULL,
        _recipients, true
      );
      _count := _count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'process_vencimientos_tareas: error en la petición % (organización %) [%]', _r.id, _r.organization_id, SQLSTATE;
    END;
  END LOOP;

  RETURN _count;
END
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- 7) Aviso "barbero deshabilitado en la sucursal": se excluye a los USUARIOS del barbero afectado
--    (antes se comparaba un id de usuario con `barberos.id`, que nunca coincidía).
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_barberos_sucursales_after_disponible_off_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  _org uuid := NEW.organization_id;
  _suc_perdida uuid := NEW.sucursal_id;
  _barbero_id uuid := NEW.barbero_id;
  _actor uuid := auth.uid();
  _actor_name text;
  _barbero_name text;
  _suc_perdida_nombre text;
  _suc_ganada_id uuid;
  _suc_ganada_nombre text;
  _recipients uuid[];
  _title text;
  _summary text;
BEGIN
  -- Nombre del actor (puede ser NULL si proviene de cron/service role).
  _actor_name := public._notif_actor_name(_actor);

  -- Nombre del barbero (de la misma org).
  SELECT TRIM(BOTH FROM (COALESCE(nombre,'') || ' ' || COALESCE(apellido,'')))
    INTO _barbero_name
  FROM public.barberos
  WHERE id = _barbero_id AND organization_id = _org;

  -- Nombre de la sucursal perdida.
  SELECT nombre INTO _suc_perdida_nombre
  FROM public.sucursales
  WHERE id = _suc_perdida AND organization_id = _org;

  -- Best-effort: sucursal "ganada" = otra fila disponible=true del mismo barbero.
  SELECT bs.sucursal_id, s.nombre
    INTO _suc_ganada_id, _suc_ganada_nombre
  FROM public.barberos_sucursales bs
  LEFT JOIN public.sucursales s
    ON s.id = bs.sucursal_id AND s.organization_id = _org
  WHERE bs.organization_id = _org
    AND bs.barbero_id = _barbero_id
    AND bs.sucursal_id <> _suc_perdida
    AND bs.disponible = true
  ORDER BY bs.updated_at DESC
  LIMIT 1;

  -- Destinatarios: admins de la org ∪ managers de la sucursal perdida, sin el actor ni los usuarios del barbero.
  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(_org) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(_org, _suc_perdida) AS user_id
      WHERE _suc_perdida IS NOT NULL
  ) s
  WHERE u IS NOT NULL
    AND (_actor IS NULL OR u <> _actor)
    AND u NOT IN (SELECT bu FROM public._notif_barbero_users(_org, _barbero_id) AS bu);

  IF _recipients IS NULL OR array_length(_recipients, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Texto.
  IF _suc_ganada_nombre IS NOT NULL THEN
    _title := COALESCE(_actor_name, 'Alguien')
              || ' habilitó a ' || COALESCE(_barbero_name, 'un barbero')
              || ' en ' || _suc_ganada_nombre
              || ' y lo deshabilitó en ' || COALESCE(_suc_perdida_nombre, 'la sucursal anterior') || '.';
  ELSE
    _title := COALESCE(_barbero_name, 'Un barbero')
              || ' fue deshabilitado en ' || COALESCE(_suc_perdida_nombre, 'la sucursal') || '.';
  END IF;
  _summary := COALESCE(_barbero_name, 'Barbero') || ' · ' || COALESCE(_suc_perdida_nombre, 'sucursal');

  PERFORM public._notif_emit(
    _org,
    'barbero_removido_sucursal',
    'barbero_removido_sucursal:' || NEW.id::text || ':' || extract(epoch from now())::bigint::text,
    _suc_perdida,
    'equipo',
    'barberos_sucursales',
    NEW.id,
    _title,
    NULL,
    _summary,
    'sistema_seguridad',
    jsonb_build_object(
      'barbero_id', _barbero_id,
      'barbero_nombre', _barbero_name,
      'sucursal_perdida_id', _suc_perdida,
      'sucursal_perdida_nombre', _suc_perdida_nombre,
      'sucursal_ganada_id', _suc_ganada_id,
      'sucursal_ganada_nombre', _suc_ganada_nombre,
      'actor_user_id', _actor
    ),
    _actor,
    _actor_name,
    _recipients,
    true
  );

  RETURN NEW;
END
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- 8) Se retira el cálculo SQL anterior (`weekly`, `biweekly`, `quarterly`, `semiannual` y `yearly`
--    caían en "+1 día"). Ya nada lo usa. Si alguna función lo referenciara, no se borra.
-- -----------------------------------------------------------------------------------------------------
DO $drop$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname <> '_calc_next_tarea_date'
                AND p.prosrc ILIKE '%_calc_next_tarea_date%') THEN
    RAISE NOTICE 'E2-M3: _calc_next_tarea_date sigue referenciada por otra función; no se elimina.';
  ELSE
    DROP FUNCTION IF EXISTS public._calc_next_tarea_date(date, text, text, integer, integer[]);
  END IF;
END
$drop$;

-- -----------------------------------------------------------------------------------------------------
-- 9) Permisos y verificación
-- -----------------------------------------------------------------------------------------------------
DO $grants$
DECLARE
  v_sig text;
  v_cerradas text[] := ARRAY[
    'public._notif_barbero_users(uuid,uuid)',
    'public._tareas_auto_generar(uuid,timestamptz)',
    'public._tareas_auto_procesar(timestamptz)',
    'public.trg_tareas_recurrentes_generar()'
  ];
  v_solo_service text[] := ARRAY[
    'public.process_tareas_recurrentes()',
    'public.process_vencimientos_tareas()'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_cerradas LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', v_sig);
    IF has_function_privilege('anon', to_regprocedure(v_sig), 'EXECUTE')
       OR has_function_privilege('authenticated', to_regprocedure(v_sig), 'EXECUTE')
       OR has_function_privilege('service_role', to_regprocedure(v_sig), 'EXECUTE') THEN
      RAISE EXCEPTION 'E2-M3 abortada: una función interna del motor quedó ejecutable por un rol de cliente.';
    END IF;
  END LOOP;

  FOREACH v_sig IN ARRAY v_solo_service LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    IF has_function_privilege('anon', to_regprocedure(v_sig), 'EXECUTE')
       OR has_function_privilege('authenticated', to_regprocedure(v_sig), 'EXECUTE')
       OR NOT has_function_privilege('service_role', to_regprocedure(v_sig), 'EXECUTE') THEN
      RAISE EXCEPTION 'E2-M3 abortada: los permisos del cron de tareas no quedaron como se esperaba.';
    END IF;
  END LOOP;
END
$grants$;
