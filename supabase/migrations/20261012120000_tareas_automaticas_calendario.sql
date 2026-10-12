-- =====================================================================================================
-- Etapa 2 · E2-M1 — Tareas automáticas: calendario canónico y "hoy" de la organización
--
-- Qué hace:
--   * Define UNA sola semántica de calendario para las Tareas automáticas (tabla técnica
--     `tareas_recurrentes`). La serie de fechas se calcula SIEMPRE desde `fecha_inicio` (el ancla),
--     nunca encadenando "fecha anterior + intervalo", para que no haya drift.
--   * Define "hoy" con `organizations.timezone` (respaldo: America/Argentina/Buenos_Aires).
--   * Solo agrega funciones internas. No cambia tablas, no toca datos, no cambia el motor actual
--     (`process_tareas_recurrentes` y `_calc_next_tarea_date` siguen como estaban hasta E2-M3).
--
-- Seguridad:
--   * Funciones SECURITY INVOKER (default), `search_path = ''` y cerradas a todos los roles de cliente.
--     Solo las usan funciones SECURITY DEFINER del mismo dueño y el cron.
--   * Preflight: aborta si Etapa 1 de seguridad de Notificaciones no está aplicada o si la estructura
--     que Etapa 2 necesita no existe. Los mensajes no incluyen nombres ni datos de clientes.
--
-- Convención de días de la semana: 0 = domingo … 6 = sábado (la misma que guarda la app en
-- `repeat_byweekday`). Las semanas empiezan el lunes.
-- =====================================================================================================

DO $preflight$
DECLARE
  v_recetas        integer;
  v_inicio_invalida integer;
  v_admin_pend     integer;
  v_tz_invalidas   integer;
  v_sin_sucursal   integer;
BEGIN
  -- Etapa 1 aplicada (validación de zona horaria + helpers cerrados).
  IF to_regprocedure('public.validate_organization_timezone()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_organizations_validate_timezone' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'E2-M1 abortada: la Etapa 1 de seguridad de Notificaciones no está aplicada (falta la validación de zona horaria).';
  END IF;
  IF to_regprocedure('public._notif_emit(uuid,text,text,uuid,text,text,uuid,text,text,text,text,jsonb,uuid,text,uuid[],boolean)') IS NULL
     OR has_function_privilege('authenticated', to_regprocedure('public._notif_emit(uuid,text,text,uuid,text,text,uuid,text,text,text,text,jsonb,uuid,text,uuid[],boolean)'), 'EXECUTE')
     OR has_function_privilege('anon', to_regprocedure('public._notif_emit(uuid,text,text,uuid,text,text,uuid,text,text,text,text,jsonb,uuid,text,uuid[],boolean)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'E2-M1 abortada: los helpers internos de notificaciones no están cerrados (Etapa 1).';
  END IF;

  -- Estructura que Etapa 2 necesita.
  IF to_regclass('public.tareas_recurrentes') IS NULL OR to_regclass('public.tareas') IS NULL THEN
    RAISE EXCEPTION 'E2-M1 abortada: faltan las tablas de tareas.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'tareas_recurrentes'
                AND column_name = 'sucursal_id' AND is_nullable = 'YES') THEN
    RAISE EXCEPTION 'E2-M1 abortada: tareas_recurrentes.sucursal_id admite NULL; se esperaba NOT NULL.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                  WHERE c.relname = 'uq_tareas_recurrencia_fecha' AND i.indisunique AND i.indisvalid) THEN
    RAISE EXCEPTION 'E2-M1 abortada: falta el índice único uq_tareas_recurrencia_fecha (clave de idempotencia).';
  END IF;

  -- Conteos informativos (sin nombres ni identificadores).
  SELECT count(*) INTO v_recetas FROM public.tareas_recurrentes;
  SELECT count(*) INTO v_inicio_invalida FROM public.tareas_recurrentes WHERE fecha_inicio IS NULL;
  SELECT count(*) INTO v_admin_pend FROM public.tareas WHERE tipo = 'admin' AND estado = 'pendiente';
  SELECT count(*) INTO v_tz_invalidas FROM public.organizations o
   WHERE o.timezone IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = o.timezone);
  SELECT count(*) INTO v_sin_sucursal FROM public.tareas WHERE recurrente AND recurrencia_id IS NULL AND sucursal_id IS NULL;
  RAISE NOTICE 'E2-M1 preflight: % tareas automáticas; % sin fecha de inicio; % tareas admin pendientes (no se tocan); % organizaciones con zona horaria inválida (usan el respaldo); % tareas repetitivas huérfanas sin sucursal (no se tocan).',
    v_recetas, v_inicio_invalida, v_admin_pend, v_tz_invalidas, v_sin_sucursal;
END
$preflight$;

-- -----------------------------------------------------------------------------------------------------
-- Lunes de la semana de un día (las semanas empiezan el lunes).
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tareas_auto_lunes(p_dia date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT p_dia - (EXTRACT(ISODOW FROM p_dia)::integer - 1)
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- Regla normalizada: (unidad, paso, días de la semana).
--   unidad 'day'   → una fecha cada `paso` días desde el ancla.
--   unidad 'week'  → los días `dias` de las semanas activas (una de cada `paso` semanas, desde la semana
--                    del ancla).
--   unidad 'month' → ancla + k·paso meses (si el mes no tiene ese día, el último día del mes).
-- Devuelve unidad NULL cuando la programación no es válida.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tareas_auto_regla(
  p_inicio date,
  p_preset text,
  p_frequency text,
  p_interval integer,
  p_byweekday integer[],
  OUT unidad text,
  OUT paso integer,
  OUT dias integer[]
)
RETURNS record
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
DECLARE
  v_dow integer;
  v_n   integer;
BEGIN
  unidad := NULL; paso := NULL; dias := NULL;
  IF p_inicio IS NULL OR p_preset IS NULL THEN
    RETURN;
  END IF;
  v_dow := EXTRACT(DOW FROM p_inicio)::integer;

  IF p_preset = 'daily' THEN
    unidad := 'day'; paso := 1;
  ELSIF p_preset = 'weekdays' THEN
    unidad := 'week'; paso := 1; dias := ARRAY[1,2,3,4,5];
  ELSIF p_preset = 'weekends' THEN
    unidad := 'week'; paso := 1; dias := ARRAY[0,6];
  ELSIF p_preset = 'weekly' THEN
    unidad := 'week'; paso := 1; dias := ARRAY[v_dow];
  ELSIF p_preset = 'biweekly' THEN
    unidad := 'week'; paso := 2; dias := ARRAY[v_dow];
  ELSIF p_preset = 'monthly' THEN
    unidad := 'month'; paso := 1;
  ELSIF p_preset = 'quarterly' THEN
    unidad := 'month'; paso := 3;
  ELSIF p_preset = 'semiannual' THEN
    unidad := 'month'; paso := 6;
  ELSIF p_preset = 'yearly' THEN
    unidad := 'month'; paso := 12;
  ELSIF p_preset = 'custom' THEN
    v_n := COALESCE(p_interval, 1);
    IF v_n < 1 OR v_n > 99 THEN
      RETURN;
    END IF;
    IF p_frequency = 'daily' THEN
      unidad := 'day'; paso := v_n;
    ELSIF p_frequency = 'weekly' THEN
      unidad := 'week'; paso := v_n;
      IF p_byweekday IS NULL OR cardinality(p_byweekday) = 0 THEN
        dias := ARRAY[v_dow];
      ELSE
        IF EXISTS (SELECT 1 FROM unnest(p_byweekday) d WHERE d IS NULL OR d NOT BETWEEN 0 AND 6) THEN
          unidad := NULL; paso := NULL; dias := NULL;
          RETURN;
        END IF;
        dias := ARRAY(SELECT DISTINCT d FROM unnest(p_byweekday) d ORDER BY d);
      END IF;
    ELSIF p_frequency = 'monthly' THEN
      unidad := 'month'; paso := v_n;
    ELSIF p_frequency = 'yearly' THEN
      unidad := 'month'; paso := 12 * v_n;
    END IF;
  END IF;
END
$fn$;

-- ¿El día pertenece a la serie semanal? (día de la semana permitido + semana activa).
CREATE OR REPLACE FUNCTION public._tareas_auto_en_semana(p_dia date, p_inicio date, p_paso integer, p_dias integer[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT p_dia >= p_inicio
     AND EXTRACT(DOW FROM p_dia)::integer = ANY (p_dias)
     AND ((public._tareas_auto_lunes(p_dia) - public._tareas_auto_lunes(p_inicio)) / 7) % p_paso = 0
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- Primera fecha de la serie ESTRICTAMENTE posterior a `p_despues_de`.
-- Devuelve NULL si la programación no es válida.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tareas_auto_siguiente(
  p_inicio date,
  p_preset text,
  p_frequency text,
  p_interval integer,
  p_byweekday integer[],
  p_despues_de date
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
DECLARE
  r record;
  v_d date;
  v_k integer;
  v_m integer;
  v_i integer;
  v_desde date;
BEGIN
  SELECT * INTO r FROM public._tareas_auto_regla(p_inicio, p_preset, p_frequency, p_interval, p_byweekday);
  IF r.unidad IS NULL OR p_despues_de IS NULL THEN
    RETURN NULL;
  END IF;

  IF r.unidad = 'day' THEN
    IF p_despues_de < p_inicio THEN
      RETURN p_inicio;
    END IF;
    RETURN p_inicio + (((p_despues_de - p_inicio) / r.paso) + 1) * r.paso;

  ELSIF r.unidad = 'month' THEN
    IF p_despues_de < p_inicio THEN
      RETURN p_inicio;
    END IF;
    v_m := (EXTRACT(YEAR FROM p_despues_de)::integer - EXTRACT(YEAR FROM p_inicio)::integer) * 12
         + (EXTRACT(MONTH FROM p_despues_de)::integer - EXTRACT(MONTH FROM p_inicio)::integer);
    v_k := v_m / r.paso;
    LOOP
      v_d := (p_inicio + make_interval(months => v_k * r.paso))::date;
      EXIT WHEN v_d > p_despues_de;
      v_k := v_k + 1;
    END LOOP;
    RETURN v_d;

  ELSE -- 'week'
    v_desde := GREATEST(p_despues_de + 1, p_inicio);
    FOR v_i IN 0 .. (7 * r.paso + 7) LOOP
      IF public._tareas_auto_en_semana(v_desde + v_i, p_inicio, r.paso, r.dias) THEN
        RETURN v_desde + v_i;
      END IF;
    END LOOP;
    RETURN NULL;
  END IF;
END
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- Última fecha de la serie menor o igual a `p_hasta` ("ocurrencia vigente" si p_hasta = hoy).
-- NULL si `p_hasta` es anterior al inicio de la serie o la programación no es válida.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tareas_auto_vigente(
  p_inicio date,
  p_preset text,
  p_frequency text,
  p_interval integer,
  p_byweekday integer[],
  p_hasta date
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
DECLARE
  r record;
  v_d date;
  v_k integer;
  v_m integer;
  v_i integer;
BEGIN
  SELECT * INTO r FROM public._tareas_auto_regla(p_inicio, p_preset, p_frequency, p_interval, p_byweekday);
  IF r.unidad IS NULL OR p_hasta IS NULL OR p_hasta < p_inicio THEN
    RETURN NULL;
  END IF;

  IF r.unidad = 'day' THEN
    RETURN p_inicio + ((p_hasta - p_inicio) / r.paso) * r.paso;

  ELSIF r.unidad = 'month' THEN
    v_m := (EXTRACT(YEAR FROM p_hasta)::integer - EXTRACT(YEAR FROM p_inicio)::integer) * 12
         + (EXTRACT(MONTH FROM p_hasta)::integer - EXTRACT(MONTH FROM p_inicio)::integer);
    v_k := v_m / r.paso;
    LOOP
      v_d := (p_inicio + make_interval(months => v_k * r.paso))::date;
      EXIT WHEN v_d <= p_hasta OR v_k = 0;
      v_k := v_k - 1;
    END LOOP;
    RETURN v_d;

  ELSE -- 'week'
    FOR v_i IN 0 .. (7 * r.paso + 7) LOOP
      v_d := p_hasta - v_i;
      EXIT WHEN v_d < p_inicio;
      IF public._tareas_auto_en_semana(v_d, p_inicio, r.paso, r.dias) THEN
        RETURN v_d;
      END IF;
    END LOOP;
    RETURN NULL;
  END IF;
END
$fn$;

-- -----------------------------------------------------------------------------------------------------
-- "Hoy" de una organización: (ahora en su zona horaria)::date. Sin zona válida → Buenos Aires.
-- `p_now` permite probar el motor con un instante fijo.
-- -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tareas_auto_hoy(p_org uuid, p_now timestamptz DEFAULT pg_catalog.now())
RETURNS date
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
  SELECT (p_now AT TIME ZONE COALESCE(
            (SELECT o.timezone
               FROM public.organizations o
              WHERE o.id = p_org
                AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = o.timezone)),
            'America/Argentina/Buenos_Aires'))::date
$fn$;

-- ¿La organización tiene una zona horaria válida? (el motor avisa cuando usa el respaldo.)
CREATE OR REPLACE FUNCTION public._tareas_auto_tz_valida(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.organizations o
     WHERE o.id = p_org
       AND o.timezone IS NOT NULL
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = o.timezone))
$fn$;

COMMENT ON FUNCTION public._tareas_auto_regla(date, text, text, integer, integer[]) IS
  'Normaliza la programación de una Tarea automática a (unidad, paso, días). unidad NULL = inválida. Etapa 2.';
COMMENT ON FUNCTION public._tareas_auto_siguiente(date, text, text, integer, integer[], date) IS
  'Primera fecha de la serie estrictamente posterior a p_despues_de. La serie se calcula siempre desde fecha_inicio. Etapa 2.';
COMMENT ON FUNCTION public._tareas_auto_vigente(date, text, text, integer, integer[], date) IS
  'Última fecha de la serie menor o igual a p_hasta (ocurrencia vigente). Etapa 2.';
COMMENT ON FUNCTION public._tareas_auto_hoy(uuid, timestamptz) IS
  'Fecha de hoy en la zona horaria de la organización (organizations.timezone; respaldo Buenos Aires). Etapa 2.';

-- -----------------------------------------------------------------------------------------------------
-- Permisos: Supabase concede EXECUTE por defecto a anon/authenticated/service_role. Se cierran todas.
-- -----------------------------------------------------------------------------------------------------
DO $grants$
DECLARE
  v_sig text;
  v_sigs text[] := ARRAY[
    'public._tareas_auto_lunes(date)',
    'public._tareas_auto_regla(date,text,text,integer,integer[])',
    'public._tareas_auto_en_semana(date,date,integer,integer[])',
    'public._tareas_auto_siguiente(date,text,text,integer,integer[],date)',
    'public._tareas_auto_vigente(date,text,text,integer,integer[],date)',
    'public._tareas_auto_hoy(uuid,timestamptz)',
    'public._tareas_auto_tz_valida(uuid)'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', v_sig);
  END LOOP;

  -- Verificación: ningún rol de cliente puede ejecutarlas.
  FOREACH v_sig IN ARRAY v_sigs LOOP
    IF has_function_privilege('anon', to_regprocedure(v_sig), 'EXECUTE')
       OR has_function_privilege('authenticated', to_regprocedure(v_sig), 'EXECUTE')
       OR has_function_privilege('service_role', to_regprocedure(v_sig), 'EXECUTE') THEN
      RAISE EXCEPTION 'E2-M1 abortada: una función interna del calendario quedó ejecutable por un rol de cliente.';
    END IF;
  END LOOP;
END
$grants$;
