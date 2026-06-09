
-- =========================================================
-- Vencimientos de tareas y peticiones: server-side
-- =========================================================

-- 1. Extensión pg_cron (necesaria para el scheduling)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Columna mínima: vencida_at
--    Necesaria para reconocer posteriormente si una tarea/petición
--    fue resuelta fuera de término (estado='completada'/'aprobada'/'rechazada'
--    + vencida_at IS NOT NULL → resuelta tarde).
ALTER TABLE public.tareas
  ADD COLUMN IF NOT EXISTS vencida_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_tareas_pendientes_venc
  ON public.tareas (organization_id, tipo, estado)
  WHERE estado = 'pendiente';

-- 3. Función backend de procesamiento (idempotente, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.process_vencimientos_tareas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r record;
  _count integer := 0;
  _recipients uuid[];
  _is_sa_creator boolean;
BEGIN
  -- ---------- TAREAS ----------
  -- Vencimiento: fecha_inicio + organizations.tareas_vencimiento_dias_default
  -- comparado en la TZ de la organización.
  FOR _r IN
    SELECT t.*, o.timezone AS org_tz,
           COALESCE(o.tareas_vencimiento_dias_default, 1) AS dias_default
    FROM public.tareas t
    JOIN public.organizations o ON o.id = t.organization_id
    WHERE t.tipo = 'tarea'
      AND t.estado = 'pendiente'
      AND t.fecha_inicio IS NOT NULL
      AND (t.fecha_inicio::date + COALESCE(o.tareas_vencimiento_dias_default, 1))
          < ((now() AT TIME ZONE COALESCE(o.timezone, 'America/Argentina/Buenos_Aires'))::date)
  LOOP
    -- Transición atómica: solo procesa si sigue pendiente
    UPDATE public.tareas
       SET estado = 'vencida',
           vencida_at = COALESCE(vencida_at, now())
     WHERE id = _r.id AND estado = 'pendiente';
    IF NOT FOUND THEN CONTINUE; END IF;
    _count := _count + 1;

    -- Destinatarios (espejo de trg_tareas_after_insert_notif)
    IF _r.assignment_scope = 'individual' AND _r.asignado_a_id IS NOT NULL THEN
      SELECT array_agg(DISTINCT u) FROM (
        SELECT _r.asignado_a_id AS u
        UNION SELECT user_id FROM public._notif_org_admins(_r.organization_id) AS user_id
        UNION SELECT user_id FROM public._notif_sucursal_managers(_r.organization_id, _r.sucursal_id) AS user_id
          WHERE _r.sucursal_id IS NOT NULL
      ) s INTO _recipients;
    ELSE
      -- team / sin asignar
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
  END LOOP;

  -- ---------- PETICIONES ----------
  -- Vencimiento: created_at + COALESCE(t.vencimiento_dias, org.peticiones_vencimiento_dias, 60) días.
  FOR _r IN
    SELECT t.*, o.timezone AS org_tz
    FROM public.tareas t
    JOIN public.organizations o ON o.id = t.organization_id
    WHERE t.tipo = 'peticion'
      AND t.estado = 'pendiente'
      AND (t.created_at + (COALESCE(t.vencimiento_dias, o.peticiones_vencimiento_dias, 60)::text || ' days')::interval)
          < now()
  LOOP
    UPDATE public.tareas
       SET estado = 'vencida',
           vencida_at = COALESCE(vencida_at, now())
     WHERE id = _r.id AND estado = 'pendiente';
    IF NOT FOUND THEN CONTINUE; END IF;
    _count := _count + 1;

    _is_sa_creator := _r.creado_por_id IS NOT NULL
                  AND public.has_role(_r.creado_por_id, 'sucursal_account'::app_role);

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
  END LOOP;

  RETURN _count;
END;
$$;

-- Permisos: solo backend/admin. NO authenticated.
REVOKE ALL ON FUNCTION public.process_vencimientos_tareas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_vencimientos_tareas() TO service_role;
