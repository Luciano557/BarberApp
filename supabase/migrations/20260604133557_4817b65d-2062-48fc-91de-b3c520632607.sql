
-- =====================================================
-- Migración B1: Motor de generación de tareas recurrentes
-- =====================================================

-- 1) Función auxiliar para calcular la próxima fecha
CREATE OR REPLACE FUNCTION public._calc_next_tarea_date(
  _current_date date,
  _repeat_preset text,
  _repeat_frequency text,
  _repeat_interval integer,
  _repeat_byweekday integer[]
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _next date;
  _dow  integer;  -- 0=Sunday ... 6=Saturday (JS convention)
  _i    integer;
  _candidate date;
  _found boolean;
  _interval integer := COALESCE(_repeat_interval, 1);
BEGIN
  IF _repeat_preset IS NULL THEN
    RETURN _current_date + 1;
  END IF;

  IF _repeat_preset = 'daily' THEN
    RETURN _current_date + 1;

  ELSIF _repeat_preset = 'weekdays' THEN
    -- Lunes a Viernes
    _next := _current_date + 1;
    LOOP
      _dow := EXTRACT(DOW FROM _next)::int; -- 0=Sun..6=Sat
      EXIT WHEN _dow BETWEEN 1 AND 5;
      _next := _next + 1;
    END LOOP;
    RETURN _next;

  ELSIF _repeat_preset = 'weekends' THEN
    _next := _current_date + 1;
    LOOP
      _dow := EXTRACT(DOW FROM _next)::int;
      EXIT WHEN _dow = 0 OR _dow = 6;
      _next := _next + 1;
    END LOOP;
    RETURN _next;

  ELSIF _repeat_preset = 'monthly' THEN
    RETURN (_current_date + (_interval || ' months')::interval)::date;

  ELSIF _repeat_preset = 'custom' THEN
    IF _repeat_frequency = 'daily' THEN
      RETURN _current_date + _interval;

    ELSIF _repeat_frequency = 'monthly' THEN
      RETURN (_current_date + (_interval || ' months')::interval)::date;

    ELSIF _repeat_frequency = 'weekly' THEN
      IF _repeat_byweekday IS NOT NULL AND array_length(_repeat_byweekday, 1) > 0 THEN
        -- Buscar el siguiente día permitido dentro de los próximos ~70 días
        FOR _i IN 1..70 LOOP
          _candidate := _current_date + _i;
          _dow := EXTRACT(DOW FROM _candidate)::int;
          IF _dow = ANY(_repeat_byweekday) THEN
            RETURN _candidate;
          END IF;
        END LOOP;
        -- Fallback
        RETURN _current_date + (7 * _interval);
      ELSE
        RETURN _current_date + (7 * _interval);
      END IF;
    ELSE
      RETURN _current_date + 1;
    END IF;
  END IF;

  RETURN _current_date + 1;
END;
$$;

COMMENT ON FUNCTION public._calc_next_tarea_date IS
  'Calcula la próxima fecha de ejecución de una receta recurrente. '
  'Replica la lógica del frontend (useGastosRecurrentes.calcNextDate). '
  'Convención: repeat_byweekday usa 0=Domingo ... 6=Sábado (JS).';


-- 2) Motor principal de generación
CREATE OR REPLACE FUNCTION public.process_tareas_recurrentes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r RECORD;
  _generated integer := 0;
  _new_proxima date;
  _safety integer;
  _barbero_nombre text;
BEGIN
  FOR _r IN
    SELECT *
      FROM public.tareas_recurrentes
     WHERE activo = true
       AND proxima_fecha <= CURRENT_DATE
  LOOP
    BEGIN
      -- Resolver nombre del barbero asignado (si aplica)
      _barbero_nombre := _r.asignado_nombre;
      IF _r.assignment_scope = 'individual'
         AND _r.asignado_a IS NOT NULL
         AND (_barbero_nombre IS NULL OR _barbero_nombre = '')
      THEN
        SELECT nombre INTO _barbero_nombre
          FROM public.barberos
         WHERE id = _r.asignado_a
         LIMIT 1;
      END IF;

      -- Insertar la tarea de este ciclo (idempotente vía uq_tareas_recurrencia_fecha)
      BEGIN
        INSERT INTO public.tareas (
          organization_id,
          sucursal_id,
          tipo,
          titulo,
          descripcion,
          estado,
          assignment_scope,
          asignado_a_id,
          asignado_a_nombre,
          creado_por_id,
          creado_por_nombre,
          hora,
          fecha_inicio,
          recurrencia_id,
          recurrente
        ) VALUES (
          _r.organization_id,
          _r.sucursal_id,
          'admin',
          _r.titulo,
          _r.descripcion,
          'pendiente',
          _r.assignment_scope,
          _r.asignado_a,
          _barbero_nombre,
          NULL,
          'Sistema',
          _r.hora,
          _r.proxima_fecha,
          _r.id,
          false
        );
        _generated := _generated + 1;
      EXCEPTION WHEN unique_violation THEN
        -- Ya existe la tarea de este ciclo, seguimos adelante
        NULL;
      END;

      -- Avanzar proxima_fecha hasta que sea > hoy (catch-up por ciclos perdidos)
      _new_proxima := _r.proxima_fecha;
      _safety := 0;
      WHILE _new_proxima <= CURRENT_DATE AND _safety < 3650 LOOP
        _new_proxima := public._calc_next_tarea_date(
          _new_proxima,
          _r.repeat_preset,
          _r.repeat_frequency,
          _r.repeat_interval,
          _r.repeat_byweekday
        );
        _safety := _safety + 1;
      END LOOP;

      UPDATE public.tareas_recurrentes
         SET proxima_fecha = _new_proxima,
             updated_at = now()
       WHERE id = _r.id;

    EXCEPTION WHEN OTHERS THEN
      -- Aislar errores por receta para no abortar el motor entero
      RAISE WARNING 'process_tareas_recurrentes: error en receta %: %', _r.id, SQLERRM;
    END;
  END LOOP;

  RETURN _generated;
END;
$$;

COMMENT ON FUNCTION public.process_tareas_recurrentes IS
  'Motor que genera tareas desde recetas en tareas_recurrentes. '
  'Idempotente vía índice uq_tareas_recurrencia_fecha. '
  'Las tareas generadas tienen creado_por_id = NULL (sistema).';


-- 3) GRANTs: solo service_role puede ejecutar el motor
REVOKE ALL ON FUNCTION public.process_tareas_recurrentes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_tareas_recurrentes() FROM anon;
REVOKE ALL ON FUNCTION public.process_tareas_recurrentes() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_tareas_recurrentes() TO service_role;

REVOKE ALL ON FUNCTION public._calc_next_tarea_date(date, text, text, integer, integer[]) FROM PUBLIC;


-- 4) Programar job pg_cron horario
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-tareas-recurrentes') THEN
    PERFORM cron.unschedule('process-tareas-recurrentes');
  END IF;

  PERFORM cron.schedule(
    'process-tareas-recurrentes',
    '0 * * * *',
    $cron$SELECT public.process_tareas_recurrentes();$cron$
  );
END$$;
