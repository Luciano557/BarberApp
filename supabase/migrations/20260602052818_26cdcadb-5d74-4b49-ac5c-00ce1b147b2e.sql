-- =========================================================
-- Vencimientos (parte 2): blindaje + backfill + cron
-- =========================================================

-- 1) Blindaje server-side: el RPC client-side `upsert_notification`
--    ya NO puede emitir 'tarea_vencida' / 'peticion_vencida'.
--    Esos eventos solo pueden generarse desde process_vencimientos_tareas()
--    vía _notif_emit (server-side).
CREATE OR REPLACE FUNCTION public.upsert_notification(
  _organization_id uuid, _event_key text, _type text, _source_module text,
  _source_table text, _source_id uuid, _title text, _body text,
  _notification_at timestamptz, _metadata jsonb,
  _sucursal_id uuid DEFAULT NULL,
  _category text DEFAULT NULL,
  _summary text DEFAULT NULL,
  _actor_user_id uuid DEFAULT NULL,
  _actor_name text DEFAULT NULL,
  _actor_account_type text DEFAULT NULL,
  _authorized_by_user_id uuid DEFAULT NULL,
  _authorized_by_name text DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _deliver_to_caller boolean DEFAULT true
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _user_org uuid;
  _row public.notifications;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _user_org := public.get_user_organization_id(_user_id);
  IF _user_org IS NULL OR _user_org <> _organization_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _event_key IS NULL OR length(btrim(_event_key)) = 0 THEN
    RAISE EXCEPTION 'event_key requerido';
  END IF;

  -- BLINDAJE: estos eventos solo se emiten server-side.
  IF _type IN ('tarea_vencida','peticion_vencida') THEN
    RAISE EXCEPTION 'Evento % no puede emitirse desde cliente', _type
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notifications (
    organization_id, event_key, type, source_module, source_table, source_id,
    title, body, notification_at, metadata,
    sucursal_id, category, summary,
    actor_user_id, actor_name, actor_account_type,
    authorized_by_user_id, authorized_by_name, expires_at
  ) VALUES (
    _organization_id, _event_key, _type, _source_module, _source_table, _source_id,
    _title, _body, COALESCE(_notification_at, now()), COALESCE(_metadata, '{}'::jsonb),
    _sucursal_id, _category, _summary,
    _actor_user_id, _actor_name, _actor_account_type,
    _authorized_by_user_id, _authorized_by_name, _expires_at
  )
  ON CONFLICT (organization_id, event_key) DO UPDATE
  SET title       = EXCLUDED.title,
      body        = EXCLUDED.body,
      summary     = COALESCE(EXCLUDED.summary, public.notifications.summary),
      category    = COALESCE(EXCLUDED.category, public.notifications.category),
      sucursal_id = COALESCE(EXCLUDED.sucursal_id, public.notifications.sucursal_id),
      metadata    = EXCLUDED.metadata,
      expires_at  = COALESCE(EXCLUDED.expires_at, public.notifications.expires_at),
      updated_at  = now()
  RETURNING * INTO _row;

  IF _deliver_to_caller THEN
    INSERT INTO public.notification_deliveries (notification_id, organization_id, user_id)
    VALUES (_row.id, _row.organization_id, _user_id)
    ON CONFLICT (notification_id, user_id) DO NOTHING;
  END IF;

  RETURN _row;
END;
$function$;

-- 2) BACKFILL SILENCIOSO: tareas y peticiones que YA estaban vencidas antes
--    de activar el nuevo flujo. Solo actualiza estado + vencida_at.
--    No genera notificaciones ni deliveries (no llama a _notif_emit).
--    Sirve como corte temporal explícito: cualquier registro creado/marcado
--    después de esta migración se procesará por el cron y SÍ notificará.
UPDATE public.tareas t
   SET estado = 'vencida',
       vencida_at = COALESCE(t.vencida_at, now())
  FROM public.organizations o
 WHERE o.id = t.organization_id
   AND t.tipo = 'tarea'
   AND t.estado = 'pendiente'
   AND t.fecha_inicio IS NOT NULL
   AND (t.fecha_inicio::date + COALESCE(o.tareas_vencimiento_dias_default, 1))
       < ((now() AT TIME ZONE COALESCE(o.timezone, 'America/Argentina/Buenos_Aires'))::date);

UPDATE public.tareas t
   SET estado = 'vencida',
       vencida_at = COALESCE(t.vencida_at, now())
  FROM public.organizations o
 WHERE o.id = t.organization_id
   AND t.tipo = 'peticion'
   AND t.estado = 'pendiente'
   AND (t.created_at + (COALESCE(t.vencimiento_dias, o.peticiones_vencimiento_dias, 60)::text || ' days')::interval)
       < now();

-- 3) CRON: ejecutar el proceso de vencimientos cada hora.
--    Si ya existía el job, lo reemplazamos limpiamente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-vencimientos-tareas') THEN
    PERFORM cron.unschedule('process-vencimientos-tareas');
  END IF;
  PERFORM cron.schedule(
    'process-vencimientos-tareas',
    '0 * * * *',
    $job$ SELECT public.process_vencimientos_tareas(); $job$
  );
END$$;