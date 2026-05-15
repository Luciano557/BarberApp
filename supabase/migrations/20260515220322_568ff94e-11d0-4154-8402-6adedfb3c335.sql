
-- =========================================================
-- Fase 3: Centro de Notificaciones — eventos operativos reales
-- =========================================================

-- ---------- 1. Helpers internos de destinatarios ----------

CREATE OR REPLACE FUNCTION public._notif_org_admins(_org uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE p.organization_id = _org
    AND ur.role IN ('owner'::app_role, 'general_manager'::app_role)
$$;

CREATE OR REPLACE FUNCTION public._notif_sucursal_managers(_org uuid, _sucursal uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  JOIN public.user_sucursales us ON us.user_id = ur.user_id
  WHERE p.organization_id = _org
    AND ur.role = 'manager'::app_role
    AND us.sucursal_id = _sucursal
$$;

CREATE OR REPLACE FUNCTION public._notif_sucursal_barbers(_org uuid, _sucursal uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id
  FROM public.profiles p
  JOIN public.barberos b ON b.id = p.barbero_id
  WHERE p.organization_id = _org
    AND b.sucursal_id = _sucursal
    AND b.activo = true
$$;

CREATE OR REPLACE FUNCTION public._notif_sucursal_account(_org uuid, _sucursal uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sa.user_id
  FROM public.sucursal_accounts sa
  WHERE sa.organization_id = _org
    AND sa.sucursal_id = _sucursal
    AND sa.user_id IS NOT NULL
$$;

-- ---------- 2. Despacho central ----------
-- Crea/upsertea notification y entrega a destinatarios filtrando por preferencias.

CREATE OR REPLACE FUNCTION public._notif_emit(
  _organization_id uuid,
  _event_type text,
  _event_key text,
  _sucursal_id uuid,
  _source_module text,
  _source_table text,
  _source_id uuid,
  _title text,
  _body text,
  _summary text,
  _category text,
  _metadata jsonb,
  _actor_user_id uuid,
  _actor_name text,
  _recipients uuid[],
  _default_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _notif public.notifications;
  _recipient uuid;
  _enabled boolean;
BEGIN
  IF _organization_id IS NULL OR _event_type IS NULL OR _event_key IS NULL THEN
    RETURN;
  END IF;
  IF _recipients IS NULL OR array_length(_recipients, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Upsert notification (idempotente por event_key)
  INSERT INTO public.notifications (
    organization_id, event_key, type, source_module, source_table, source_id,
    title, body, notification_at, metadata,
    sucursal_id, category, summary,
    actor_user_id, actor_name
  ) VALUES (
    _organization_id, _event_key, _event_type, _source_module, _source_table, _source_id,
    _title, _body, now(), COALESCE(_metadata, '{}'::jsonb),
    _sucursal_id, _category, _summary,
    _actor_user_id, _actor_name
  )
  ON CONFLICT (organization_id, event_key) DO UPDATE
  SET title = EXCLUDED.title,
      body  = EXCLUDED.body,
      summary = COALESCE(EXCLUDED.summary, public.notifications.summary),
      metadata = EXCLUDED.metadata,
      updated_at = now()
  RETURNING * INTO _notif;

  -- Para cada destinatario, verificar preferencia y entregar
  FOREACH _recipient IN ARRAY _recipients LOOP
    IF _recipient IS NULL THEN CONTINUE; END IF;

    -- Validar que el destinatario pertenece a la organización
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = _recipient AND organization_id = _organization_id
    ) THEN
      CONTINUE;
    END IF;

    -- Resolver preferencia (default si no hay fila)
    SELECT enabled INTO _enabled
    FROM public.user_notification_preferences
    WHERE user_id = _recipient AND event_type = _event_type
    LIMIT 1;
    IF _enabled IS NULL THEN _enabled := _default_enabled; END IF;
    IF NOT _enabled THEN CONTINUE; END IF;

    INSERT INTO public.notification_deliveries (notification_id, organization_id, user_id)
    VALUES (_notif.id, _organization_id, _recipient)
    ON CONFLICT (notification_id, user_id) DO NOTHING;
  END LOOP;
END;
$$;

-- ---------- 3. Trigger: bloquear peticiones desde rol barber ----------

CREATE OR REPLACE FUNCTION public.trg_tareas_block_barber_peticion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'peticion'
     AND NEW.creado_por_id IS NOT NULL
     AND public.has_role(NEW.creado_por_id, 'barber'::app_role)
     AND NOT public.has_role(NEW.creado_por_id, 'owner'::app_role)
     AND NOT public.has_role(NEW.creado_por_id, 'general_manager'::app_role)
     AND NOT public.has_role(NEW.creado_por_id, 'manager'::app_role)
     AND NOT public.has_role(NEW.creado_por_id, 'sucursal_account'::app_role)
  THEN
    RAISE EXCEPTION 'Los barberos no pueden crear peticiones';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tareas_block_barber_peticion ON public.tareas;
CREATE TRIGGER trg_tareas_block_barber_peticion
BEFORE INSERT ON public.tareas
FOR EACH ROW EXECUTE FUNCTION public.trg_tareas_block_barber_peticion();

-- ---------- 4. Trigger: tareas — INSERT (asignación / petición nueva) ----------

CREATE OR REPLACE FUNCTION public.trg_tareas_after_insert_notif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _recipients uuid[];
  _is_sa_creator boolean;
BEGIN
  IF NEW.tipo = 'tarea' THEN
    IF NEW.assignment_scope = 'individual' AND NEW.asignado_a_id IS NOT NULL THEN
      -- tarea_asignada
      SELECT array_agg(DISTINCT u) FROM (
        SELECT NEW.asignado_a_id AS u
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
                  AND public.has_role(NEW.creado_por_id, 'sucursal_account'::app_role);

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
END;
$$;

DROP TRIGGER IF EXISTS trg_tareas_after_insert_notif ON public.tareas;
CREATE TRIGGER trg_tareas_after_insert_notif
AFTER INSERT ON public.tareas
FOR EACH ROW EXECUTE FUNCTION public.trg_tareas_after_insert_notif();

-- ---------- 5. Trigger: tareas — UPDATE (peticion aprobada/rechazada) ----------

CREATE OR REPLACE FUNCTION public.trg_tareas_after_update_notif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _recipients uuid[];
  _event_type text;
  _event_key_suffix text;
  _category text;
BEGIN
  IF NEW.tipo <> 'peticion' THEN RETURN NEW; END IF;
  IF OLD.estado = NEW.estado THEN RETURN NEW; END IF;

  IF NEW.estado = 'aprobada' THEN
    _event_type := 'peticion_aprobada';
    _event_key_suffix := 'aprobada';
    _category := 'gestion_interna';
  ELSIF NEW.estado = 'rechazada' THEN
    _event_type := 'peticion_rechazada';
    _event_key_suffix := 'rechazada';
    _category := 'gestion_interna';
  ELSE
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT u) FROM (
    SELECT NEW.creado_por_id AS u WHERE NEW.creado_por_id IS NOT NULL
    UNION SELECT user_id FROM public._notif_org_admins(NEW.organization_id) AS user_id
    UNION SELECT user_id FROM public._notif_sucursal_managers(NEW.organization_id, NEW.sucursal_id) AS user_id
      WHERE NEW.sucursal_id IS NOT NULL
  ) s INTO _recipients;

  PERFORM public._notif_emit(
    NEW.organization_id, _event_type,
    'peticion:' || NEW.id::text || ':' || _event_key_suffix,
    NEW.sucursal_id, 'tareas', 'tareas', NEW.id,
    NEW.titulo, NEW.descripcion, NULL, _category,
    jsonb_build_object('creado_por_nombre', NEW.creado_por_nombre),
    NULL, NULL,
    _recipients, true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tareas_after_update_notif ON public.tareas;
CREATE TRIGGER trg_tareas_after_update_notif
AFTER UPDATE OF estado ON public.tareas
FOR EACH ROW EXECUTE FUNCTION public.trg_tareas_after_update_notif();

-- ---------- 6. Helpers de turnos ----------
-- Construye metadata sin PII (sin telefono/email/notas) y resuelve servicio_nombre.

CREATE OR REPLACE FUNCTION public._notif_turno_metadata(_turno public.turnos)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'fecha', _turno.fecha,
    'hora_inicio', _turno.hora_inicio,
    'hora_fin', _turno.hora_fin,
    'barbero_id', _turno.barbero_id,
    'barbero_nombre', (SELECT (b.nombre || ' ' || COALESCE(b.apellido, '')) FROM public.barberos b WHERE b.id = _turno.barbero_id),
    'servicio_nombre', (SELECT s.nombre FROM public.servicios s WHERE s.id = _turno.servicio_id),
    'cliente_nombre', _turno.cliente_nombre
  )
$$;

CREATE OR REPLACE FUNCTION public._notif_turno_title(_turno public.turnos, _verbo text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'Turno ' || _verbo || ' · ' ||
         to_char(_turno.fecha, 'DD/MM') || ' ' ||
         to_char(_turno.hora_inicio, 'HH24:MI')
$$;

-- ---------- 7. Despacho de eventos de turno (3 scopes) ----------

CREATE OR REPLACE FUNCTION public._notif_turno_dispatch(
  _turno public.turnos,
  _verbo text,             -- 'creado'|'reprogramado'|'cancelado'
  _event_key_suffix text   -- ej 'creado' o 'reprogramado:<fecha>:<hora>:<barbero>'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meta jsonb := public._notif_turno_metadata(_turno);
  _title text := public._notif_turno_title(_turno, _verbo);
  _assigned uuid;          -- profile id del barbero asignado
  _propio uuid[];
  _companeros uuid[];
  _gestion uuid[];
BEGIN
  -- Resolver el user del barbero asignado
  SELECT p.id INTO _assigned
  FROM public.profiles p
  WHERE p.organization_id = _turno.organization_id
    AND p.barbero_id = _turno.barbero_id
  LIMIT 1;

  -- Propio
  IF _assigned IS NOT NULL THEN
    _propio := ARRAY[_assigned];
    PERFORM public._notif_emit(
      _turno.organization_id, 'turno_' || _verbo || '_propio',
      'turno:' || _turno.id::text || ':' || _event_key_suffix || ':propio',
      _turno.sucursal_id, 'agenda', 'turnos', _turno.id,
      _title, NULL, NULL, 'actividad_operativa',
      _meta, NULL, NULL,
      _propio, true
    );
  END IF;

  -- Compañeros (mismos barberos de la sucursal, distintos del asignado)
  SELECT array_agg(user_id) INTO _companeros FROM (
    SELECT user_id FROM public._notif_sucursal_barbers(_turno.organization_id, _turno.sucursal_id) AS user_id
    WHERE user_id IS DISTINCT FROM _assigned
  ) c;

  IF _companeros IS NOT NULL AND array_length(_companeros, 1) IS NOT NULL THEN
    PERFORM public._notif_emit(
      _turno.organization_id, 'turno_' || _verbo || '_companero',
      'turno:' || _turno.id::text || ':' || _event_key_suffix || ':companero',
      _turno.sucursal_id, 'agenda', 'turnos', _turno.id,
      _title, NULL, NULL, 'actividad_operativa',
      _meta, NULL, NULL,
      _companeros, true
    );
  END IF;

  -- Gestión: owner+gm+manager(sucursal)+sucursal_account(sucursal), excluyendo barbers ya cubiertos
  SELECT array_agg(DISTINCT u) INTO _gestion FROM (
    SELECT user_id AS u FROM public._notif_org_admins(_turno.organization_id) AS user_id
    UNION SELECT user_id FROM public._notif_sucursal_managers(_turno.organization_id, _turno.sucursal_id) AS user_id
    UNION SELECT user_id FROM public._notif_sucursal_account(_turno.organization_id, _turno.sucursal_id) AS user_id
  ) g
  WHERE u IS DISTINCT FROM _assigned
    AND (_companeros IS NULL OR NOT (u = ANY(_companeros)));

  IF _gestion IS NOT NULL AND array_length(_gestion, 1) IS NOT NULL THEN
    PERFORM public._notif_emit(
      _turno.organization_id, 'turno_' || _verbo,
      'turno:' || _turno.id::text || ':' || _event_key_suffix || ':gestion',
      _turno.sucursal_id, 'agenda', 'turnos', _turno.id,
      _title, NULL, NULL, 'actividad_operativa',
      _meta, NULL, NULL,
      _gestion, true
    );
  END IF;
END;
$$;

-- ---------- 8. Triggers de turnos ----------

CREATE OR REPLACE FUNCTION public.trg_turnos_after_insert_notif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.estado = 'cancelado' THEN
    RETURN NEW;
  END IF;
  PERFORM public._notif_turno_dispatch(NEW, 'creado', 'creado');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_turnos_after_insert_notif ON public.turnos;
CREATE TRIGGER trg_turnos_after_insert_notif
AFTER INSERT ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.trg_turnos_after_insert_notif();

CREATE OR REPLACE FUNCTION public.trg_turnos_after_update_notif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _suffix text;
BEGIN
  -- Cancelación tiene prioridad sobre reprogramación
  IF OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado = 'cancelado' THEN
    PERFORM public._notif_turno_dispatch(NEW, 'cancelado', 'cancelado');
    RETURN NEW;
  END IF;

  -- Reprogramación solo por cambios relevantes y siempre que no quede cancelado
  IF NEW.estado <> 'cancelado'
     AND (
       OLD.fecha IS DISTINCT FROM NEW.fecha
       OR OLD.hora_inicio IS DISTINCT FROM NEW.hora_inicio
       OR OLD.hora_fin IS DISTINCT FROM NEW.hora_fin
       OR OLD.barbero_id IS DISTINCT FROM NEW.barbero_id
       OR OLD.sucursal_id IS DISTINCT FROM NEW.sucursal_id
     )
  THEN
    _suffix := 'reprogramado:'
      || COALESCE(NEW.fecha::text, '') || ':'
      || COALESCE(NEW.hora_inicio::text, '') || ':'
      || COALESCE(NEW.barbero_id::text, '');
    PERFORM public._notif_turno_dispatch(NEW, 'reprogramado', _suffix);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_turnos_after_update_notif ON public.turnos;
CREATE TRIGGER trg_turnos_after_update_notif
AFTER UPDATE ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.trg_turnos_after_update_notif();
