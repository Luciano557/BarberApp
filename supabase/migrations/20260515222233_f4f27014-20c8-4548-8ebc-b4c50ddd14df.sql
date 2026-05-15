
-- ============================================================
-- Fase 4: Centro de Notificaciones — eventos sensibles
-- ============================================================

-- 1) Extender preferencias con `mode` (compatible con `enabled`)
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS mode text;

ALTER TABLE public.user_notification_preferences
  DROP CONSTRAINT IF EXISTS user_notification_preferences_mode_check;
ALTER TABLE public.user_notification_preferences
  ADD CONSTRAINT user_notification_preferences_mode_check
  CHECK (mode IS NULL OR mode IN ('disabled','always','sucursal_account_only'));

-- 2) Helpers
CREATE OR REPLACE FUNCTION public._notif_pref_mode(_user uuid, _event_type text, _default_mode text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mode text;
  _enabled boolean;
BEGIN
  SELECT mode, enabled INTO _mode, _enabled
  FROM public.user_notification_preferences
  WHERE user_id = _user AND event_type = _event_type
  LIMIT 1;

  IF _mode IS NOT NULL THEN
    RETURN _mode;
  END IF;

  IF _enabled IS NULL THEN
    -- sin fila → default
    RETURN COALESCE(_default_mode, 'always');
  END IF;

  RETURN CASE WHEN _enabled THEN COALESCE(_default_mode, 'always') ELSE 'disabled' END;
END;
$$;

CREATE OR REPLACE FUNCTION public._notif_actor_account_type(_user uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user IS NULL THEN 'system'
    WHEN public.has_role(_user, 'sucursal_account'::app_role) THEN 'sucursal_account'
    ELSE 'personal_account'
  END
$$;

CREATE OR REPLACE FUNCTION public._notif_actor_name(_user uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(p.full_name, p.email)
  FROM public.profiles p WHERE p.id = _user
$$;

-- 3) Dispatcher para eventos sensibles con soporte de modo
CREATE OR REPLACE FUNCTION public._notif_emit_sensitive(
  _organization_id uuid,
  _event_type text,
  _event_key text,
  _sucursal_id uuid,
  _source_module text,
  _source_table text,
  _source_id uuid,
  _title text,
  _summary text,
  _category text,
  _metadata jsonb,
  _actor_user_id uuid,
  _recipients uuid[],
  _supports_mode boolean,
  _default_mode text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _notif public.notifications;
  _recipient uuid;
  _mode text;
  _actor_type text := public._notif_actor_account_type(_actor_user_id);
  _actor_name text := public._notif_actor_name(_actor_user_id);
  _meta jsonb;
BEGIN
  IF _organization_id IS NULL OR _event_type IS NULL OR _event_key IS NULL THEN RETURN; END IF;
  IF _recipients IS NULL OR array_length(_recipients,1) IS NULL THEN RETURN; END IF;

  _meta := COALESCE(_metadata, '{}'::jsonb)
        || jsonb_build_object('actor_account_type', _actor_type);

  INSERT INTO public.notifications (
    organization_id, event_key, type, source_module, source_table, source_id,
    title, body, notification_at, metadata, sucursal_id, category, summary,
    actor_user_id, actor_name, actor_account_type
  ) VALUES (
    _organization_id, _event_key, _event_type, _source_module, _source_table, _source_id,
    _title, NULL, now(), _meta, _sucursal_id, _category, _summary,
    _actor_user_id, _actor_name, _actor_type
  )
  ON CONFLICT (organization_id, event_key) DO UPDATE
  SET title = EXCLUDED.title,
      summary = COALESCE(EXCLUDED.summary, public.notifications.summary),
      metadata = EXCLUDED.metadata,
      updated_at = now()
  RETURNING * INTO _notif;

  FOREACH _recipient IN ARRAY _recipients LOOP
    IF _recipient IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _recipient AND organization_id = _organization_id) THEN
      CONTINUE;
    END IF;

    IF _supports_mode THEN
      _mode := public._notif_pref_mode(_recipient, _event_type, _default_mode);
      IF _mode = 'disabled' THEN CONTINUE; END IF;
      IF _mode = 'sucursal_account_only' AND _actor_type <> 'sucursal_account' THEN CONTINUE; END IF;
    ELSE
      _mode := public._notif_pref_mode(_recipient, _event_type, COALESCE(_default_mode,'always'));
      IF _mode = 'disabled' THEN CONTINUE; END IF;
    END IF;

    INSERT INTO public.notification_deliveries (notification_id, organization_id, user_id)
    VALUES (_notif.id, _organization_id, _recipient)
    ON CONFLICT (notification_id, user_id) DO NOTHING;
  END LOOP;
END;
$$;

-- 4) CAJA: cierre realizado / cierre día anterior
-- ingresos.closed_at se setea al cerrar; identificador agrupa la corrida
CREATE OR REPLACE FUNCTION public.trg_ingresos_after_cierre_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_backfill boolean;
  _event text;
  _suffix text;
  _recipients uuid[];
  _key text;
BEGIN
  -- Solo cuando pasa de "no cerrado" a "cerrado"
  IF NEW.closed_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.closed_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.identificador IS NULL THEN RETURN NEW; END IF;

  _is_backfill := (NEW.entry_mode = 'backfill') OR (NEW.backfilled_at IS NOT NULL);
  IF _is_backfill THEN
    _event := 'cierre_caja_dia_anterior_realizado';
    _suffix := 'cierre_dia_anterior';
  ELSE
    _event := 'cierre_caja_realizado';
    _suffix := 'cierre_realizado';
  END IF;

  _key := 'caja:' || NEW.identificador::text || ':' || _suffix;

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(NEW.organization_id) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(NEW.organization_id, NEW.sucursal_id) AS user_id
      WHERE NEW.sucursal_id IS NOT NULL
  ) s;

  PERFORM public._notif_emit_sensitive(
    NEW.organization_id, _event, _key, NEW.sucursal_id,
    'caja', 'ingresos', NULL,
    'Cierre de caja realizado',
    NULL, 'caja',
    jsonb_build_object(
      'fecha', NEW.dia,
      'sucursal_id', NEW.sucursal_id,
      'total_cobrado', NEW.total_cobrado,
      'is_backfill', _is_backfill,
      'identificador', NEW.identificador
    ),
    COALESCE(NEW.backfilled_by, auth.uid()),
    _recipients, true, 'always'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ingresos_after_cierre_notif_ins ON public.ingresos;
DROP TRIGGER IF EXISTS trg_ingresos_after_cierre_notif_upd ON public.ingresos;
CREATE TRIGGER trg_ingresos_after_cierre_notif_ins
  AFTER INSERT ON public.ingresos
  FOR EACH ROW EXECUTE FUNCTION public.trg_ingresos_after_cierre_notif();
CREATE TRIGGER trg_ingresos_after_cierre_notif_upd
  AFTER UPDATE OF closed_at ON public.ingresos
  FOR EACH ROW EXECUTE FUNCTION public.trg_ingresos_after_cierre_notif();

-- 5) CAJA: anulación de cierre
CREATE OR REPLACE FUNCTION public.trg_anulaciones_cierre_after_insert_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _suc uuid;
  _recipients uuid[];
BEGIN
  SELECT sucursal_id INTO _suc FROM public.ingresos WHERE id = NEW.ingreso_id LIMIT 1;

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(NEW.organization_id) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(NEW.organization_id, _suc) AS user_id
      WHERE _suc IS NOT NULL
  ) s;

  PERFORM public._notif_emit_sensitive(
    NEW.organization_id, 'anulacion_cierre',
    'cierre:' || NEW.id::text || ':anulado',
    _suc, 'caja', 'anulaciones_cierre', NEW.id,
    'Cierre de caja anulado', NEW.motivo, 'caja',
    jsonb_build_object(
      'ingreso_id', NEW.ingreso_id,
      'fecha_cierre', NEW.fecha_cierre,
      'motivo', NEW.motivo,
      'barbero_nombre', NEW.barbero_nombre
    ),
    COALESCE(NEW.anulado_por_id, auth.uid()),
    _recipients, true, 'always'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anulaciones_cierre_after_insert_notif ON public.anulaciones_cierre;
CREATE TRIGGER trg_anulaciones_cierre_after_insert_notif
  AFTER INSERT ON public.anulaciones_cierre
  FOR EACH ROW EXECUTE FUNCTION public.trg_anulaciones_cierre_after_insert_notif();

-- 6) CAJA: transacción anulada
CREATE OR REPLACE FUNCTION public.trg_venta_after_anulada_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _recipients uuid[];
  _actor uuid;
BEGIN
  IF NOT (COALESCE(OLD.estado,'activo') <> 'anulado' AND NEW.estado = 'anulado') THEN
    RETURN NEW;
  END IF;

  -- anulado_por_id en `venta` está como text; intentar cast
  BEGIN
    _actor := NULLIF(NEW.anulado_por_id,'')::uuid;
  EXCEPTION WHEN OTHERS THEN _actor := NULL;
  END;
  _actor := COALESCE(_actor, auth.uid());

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(NEW.organization_id) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(NEW.organization_id, NEW.sucursal_id) AS user_id
      WHERE NEW.sucursal_id IS NOT NULL
  ) s;

  PERFORM public._notif_emit_sensitive(
    NEW.organization_id, 'transaccion_anulada',
    'transaccion:' || NEW.id::text || ':anulada',
    NEW.sucursal_id, 'caja', 'venta', NEW.id,
    'Transacción anulada', NULL, 'caja',
    jsonb_build_object(
      'monto', NEW.total_cobrado,
      'metodo_pago', NEW.metodo_pago,
      'tipo_venta', NEW.tipo_venta,
      'barbero_nombre', NEW.barbero_nombre,
      'fecha', NEW.fecha_hora
    ),
    _actor, _recipients, true, 'always'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venta_after_anulada_notif ON public.venta;
CREATE TRIGGER trg_venta_after_anulada_notif
  AFTER UPDATE OF estado ON public.venta
  FOR EACH ROW EXECUTE FUNCTION public.trg_venta_after_anulada_notif();

-- 7) GASTOS (Egresos)
CREATE OR REPLACE FUNCTION public.trg_egresos_after_insert_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _recipients uuid[];
BEGIN
  IF COALESCE(NEW.estado,'activo') = 'anulado' THEN RETURN NEW; END IF;

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(NEW.organization_id) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(NEW.organization_id, NEW.sucursal_id) AS user_id
      WHERE NEW.sucursal_id IS NOT NULL
  ) s;

  PERFORM public._notif_emit_sensitive(
    NEW.organization_id, 'gasto_registrado',
    'gasto:' || NEW.id::text || ':registrado',
    NEW.sucursal_id, 'finanzas', 'Egresos', NULL,
    'Gasto registrado', NEW."Descripcion", 'finanzas',
    jsonb_build_object(
      'monto', NEW."Monto",
      'categoria', NEW."Categoria",
      'descripcion', NEW."Descripcion",
      'fecha', NEW."Fecha",
      'tipo_costo', NEW.tipo_costo,
      'gasto_id', NEW.id
    ),
    auth.uid(), _recipients, true, 'always'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_egresos_after_update_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _recipients uuid[];
  _is_anulacion boolean;
  _is_edit boolean;
BEGIN
  _is_anulacion := COALESCE(OLD.estado,'activo') <> 'anulado' AND NEW.estado = 'anulado';
  _is_edit := NOT _is_anulacion AND COALESCE(NEW.estado,'activo') <> 'anulado' AND (
       OLD."Monto" IS DISTINCT FROM NEW."Monto"
    OR OLD."Categoria" IS DISTINCT FROM NEW."Categoria"
    OR OLD."Descripcion" IS DISTINCT FROM NEW."Descripcion"
    OR OLD."Fecha" IS DISTINCT FROM NEW."Fecha"
    OR OLD.tipo_costo IS DISTINCT FROM NEW.tipo_costo
  );

  IF NOT (_is_anulacion OR _is_edit) THEN RETURN NEW; END IF;

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(NEW.organization_id) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(NEW.organization_id, NEW.sucursal_id) AS user_id
      WHERE NEW.sucursal_id IS NOT NULL
  ) s;

  IF _is_anulacion THEN
    PERFORM public._notif_emit_sensitive(
      NEW.organization_id, 'gasto_anulado',
      'gasto:' || NEW.id::text || ':anulado',
      NEW.sucursal_id, 'finanzas', 'Egresos', NULL,
      'Gasto anulado', NEW.anulado_motivo, 'finanzas',
      jsonb_build_object(
        'monto', NEW."Monto",
        'categoria', NEW."Categoria",
        'motivo', NEW.anulado_motivo,
        'gasto_id', NEW.id
      ),
      COALESCE(NEW.anulado_por, auth.uid()),
      _recipients, true, 'always'
    );
  ELSE
    PERFORM public._notif_emit_sensitive(
      NEW.organization_id, 'gasto_editado',
      'gasto:' || NEW.id::text || ':editado:' || extract(epoch from now())::bigint::text,
      NEW.sucursal_id, 'finanzas', 'Egresos', NULL,
      'Gasto editado', NEW."Descripcion", 'finanzas',
      jsonb_build_object(
        'monto', NEW."Monto",
        'categoria', NEW."Categoria",
        'descripcion', NEW."Descripcion",
        'gasto_id', NEW.id,
        'cambios', jsonb_strip_nulls(jsonb_build_object(
          'monto_old', CASE WHEN OLD."Monto" IS DISTINCT FROM NEW."Monto" THEN OLD."Monto" END,
          'categoria_old', CASE WHEN OLD."Categoria" IS DISTINCT FROM NEW."Categoria" THEN OLD."Categoria" END,
          'descripcion_old', CASE WHEN OLD."Descripcion" IS DISTINCT FROM NEW."Descripcion" THEN OLD."Descripcion" END
        ))
      ),
      auth.uid(), _recipients, true, 'always'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_egresos_after_insert_notif ON public."Egresos";
DROP TRIGGER IF EXISTS trg_egresos_after_update_notif ON public."Egresos";
CREATE TRIGGER trg_egresos_after_insert_notif
  AFTER INSERT ON public."Egresos"
  FOR EACH ROW EXECUTE FUNCTION public.trg_egresos_after_insert_notif();
CREATE TRIGGER trg_egresos_after_update_notif
  AFTER UPDATE ON public."Egresos"
  FOR EACH ROW EXECUTE FUNCTION public.trg_egresos_after_update_notif();

-- 8) INVERSIONES / DEUDAS — solo owner+gm
CREATE OR REPLACE FUNCTION public.trg_inversiones_after_insert_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _recipients uuid[];
BEGIN
  SELECT array_agg(user_id) INTO _recipients
  FROM public._notif_org_admins(NEW.organization_id) AS user_id;

  PERFORM public._notif_emit_sensitive(
    NEW.organization_id, 'inversion_creada',
    'inversion:' || NEW.id::text || ':creada',
    NEW.sucursal_id, 'finanzas', 'inversiones', NEW.id,
    'Inversión creada', NEW.nombre, 'finanzas',
    jsonb_build_object(
      'monto_total', NEW.monto_total,
      'nombre', NEW.nombre,
      'categoria', NEW.categoria,
      'meses_amortizacion', NEW.meses_amortizacion,
      'fecha_compra', NEW.fecha_compra
    ),
    auth.uid(), _recipients, false, 'always'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inversiones_after_insert_notif ON public.inversiones;
CREATE TRIGGER trg_inversiones_after_insert_notif
  AFTER INSERT ON public.inversiones
  FOR EACH ROW EXECUTE FUNCTION public.trg_inversiones_after_insert_notif();

CREATE OR REPLACE FUNCTION public.trg_deudas_after_insert_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _recipients uuid[];
BEGIN
  SELECT array_agg(user_id) INTO _recipients
  FROM public._notif_org_admins(NEW.organization_id) AS user_id;

  PERFORM public._notif_emit_sensitive(
    NEW.organization_id, 'deuda_creada',
    'deuda:' || NEW.id::text || ':creada',
    NEW.sucursal_id, 'finanzas', 'deudas', NEW.id,
    'Deuda registrada', NEW.acreedor, 'finanzas',
    jsonb_build_object(
      'monto_total', NEW.monto_total,
      'acreedor', NEW.acreedor,
      'cuotas_totales', NEW.cuotas_totales,
      'fecha_inicio', NEW.fecha_inicio
    ),
    auth.uid(), _recipients, false, 'always'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deudas_after_insert_notif ON public.deudas;
CREATE TRIGGER trg_deudas_after_insert_notif
  AFTER INSERT ON public.deudas
  FOR EACH ROW EXECUTE FUNCTION public.trg_deudas_after_insert_notif();

-- 9) SUELDOS — pago registrado (solo owner+gm)
CREATE OR REPLACE FUNCTION public.trg_pagos_sueldos_after_insert_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _recipients uuid[];
BEGIN
  SELECT array_agg(user_id) INTO _recipients
  FROM public._notif_org_admins(NEW.organization_id) AS user_id;

  PERFORM public._notif_emit_sensitive(
    NEW.organization_id, 'pago_sueldo_registrado',
    'sueldo_pago:' || NEW.id::text || ':registrado',
    NEW.sucursal_id, 'sueldos', 'pagos_sueldos', NEW.id,
    'Pago de sueldo registrado', NEW.concepto, 'sueldos',
    jsonb_build_object(
      'monto', NEW.monto,
      'barbero_nombre', NEW.barbero_nombre,
      'fecha', NEW.fecha,
      'concepto', NEW.concepto
    ),
    auth.uid(), _recipients, true, 'always'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagos_sueldos_after_insert_notif ON public.pagos_sueldos;
CREATE TRIGGER trg_pagos_sueldos_after_insert_notif
  AFTER INSERT ON public.pagos_sueldos
  FOR EACH ROW EXECUTE FUNCTION public.trg_pagos_sueldos_after_insert_notif();

-- 10) SEGURIDAD: cambio de roles
CREATE OR REPLACE FUNCTION public.trg_user_roles_after_change_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org uuid;
  _affected uuid;
  _affected_name text;
  _role_text text;
  _action text;
  _recipients uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    _affected := NEW.user_id; _role_text := NEW.role::text; _action := 'asignado';
  ELSIF TG_OP = 'DELETE' THEN
    _affected := OLD.user_id; _role_text := OLD.role::text; _action := 'removido';
  ELSE
    _affected := NEW.user_id; _role_text := NEW.role::text; _action := 'modificado';
  END IF;

  SELECT organization_id, COALESCE(full_name, email) INTO _org, _affected_name
  FROM public.profiles WHERE id = _affected;
  IF _org IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT array_agg(user_id) INTO _recipients
  FROM public._notif_org_admins(_org) AS user_id;

  PERFORM public._notif_emit_sensitive(
    _org, 'cambio_roles',
    'seguridad:role:' || _affected::text || ':' || _role_text || ':' || _action || ':' || extract(epoch from now())::bigint::text,
    NULL, 'seguridad', 'user_roles', NULL,
    'Cambio de cargo', _affected_name || ' · ' || _action || ' ' || _role_text, 'seguridad',
    jsonb_build_object(
      'usuario_afectado_id', _affected,
      'usuario_afectado_nombre', _affected_name,
      'rol', _role_text,
      'accion', _action
    ),
    auth.uid(), _recipients, false, 'always'
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_after_change_notif ON public.user_roles;
CREATE TRIGGER trg_user_roles_after_change_notif
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_user_roles_after_change_notif();

-- 11) SEGURIDAD: cambio de permisos (user_sucursales)
CREATE OR REPLACE FUNCTION public.trg_user_sucursales_after_change_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org uuid;
  _suc uuid;
  _affected uuid;
  _affected_name text;
  _action text;
  _recipients uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    _org := NEW.organization_id; _suc := NEW.sucursal_id; _affected := NEW.user_id; _action := 'asignado';
  ELSE
    _org := OLD.organization_id; _suc := OLD.sucursal_id; _affected := OLD.user_id; _action := 'removido';
  END IF;

  SELECT COALESCE(full_name, email) INTO _affected_name FROM public.profiles WHERE id = _affected;

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(_org) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(_org, _suc) AS user_id
      WHERE _suc IS NOT NULL
  ) s;

  PERFORM public._notif_emit_sensitive(
    _org, 'cambio_permisos',
    'seguridad:permisos:' || _affected::text || ':' || COALESCE(_suc::text,'null') || ':' || _action || ':' || extract(epoch from now())::bigint::text,
    _suc, 'seguridad', 'user_sucursales', NULL,
    'Cambio de acceso a sucursal', _affected_name || ' · ' || _action, 'seguridad',
    jsonb_build_object(
      'usuario_afectado_id', _affected,
      'usuario_afectado_nombre', _affected_name,
      'sucursal_id', _suc,
      'accion', _action
    ),
    auth.uid(), _recipients, false, 'always'
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_user_sucursales_after_change_notif ON public.user_sucursales;
CREATE TRIGGER trg_user_sucursales_after_change_notif
  AFTER INSERT OR DELETE ON public.user_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.trg_user_sucursales_after_change_notif();

-- 12) SEGURIDAD: configuración crítica (PIN config) — alcance parcial
CREATE OR REPLACE FUNCTION public.trg_pin_config_after_change_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org uuid;
  _suc uuid;
  _action_key text;
  _requires boolean;
  _action text;
  _recipients uuid[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    _org := OLD.organization_id; _suc := OLD.sucursal_id; _action_key := OLD.action_key;
    _requires := OLD.requires_pin; _action := 'eliminado';
  ELSIF TG_OP = 'INSERT' THEN
    _org := NEW.organization_id; _suc := NEW.sucursal_id; _action_key := NEW.action_key;
    _requires := NEW.requires_pin; _action := 'creado';
  ELSE
    IF OLD.requires_pin = NEW.requires_pin THEN RETURN NEW; END IF;
    _org := NEW.organization_id; _suc := NEW.sucursal_id; _action_key := NEW.action_key;
    _requires := NEW.requires_pin; _action := 'actualizado';
  END IF;

  SELECT array_agg(user_id) INTO _recipients
  FROM public._notif_org_admins(_org) AS user_id;

  PERFORM public._notif_emit_sensitive(
    _org, 'cambio_configuracion_critica',
    'seguridad:config:pin:' || _action_key || ':' || COALESCE(_suc::text,'org') || ':' || extract(epoch from now())::bigint::text,
    _suc, 'seguridad', 'sucursal_action_pin_config', NULL,
    'Configuración de PIN actualizada',
    _action_key || ' · ' || (CASE WHEN _requires THEN 'requiere PIN' ELSE 'sin PIN' END),
    'seguridad',
    jsonb_build_object(
      'action_key', _action_key,
      'requires_pin', _requires,
      'sucursal_id', _suc,
      'accion', _action
    ),
    auth.uid(), _recipients, false, 'always'
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_pin_config_after_change_notif ON public.sucursal_action_pin_config;
CREATE TRIGGER trg_pin_config_after_change_notif
  AFTER INSERT OR UPDATE OR DELETE ON public.sucursal_action_pin_config
  FOR EACH ROW EXECUTE FUNCTION public.trg_pin_config_after_change_notif();

-- 13) RPC públicos para edge functions / frontend (visualización, login, PIN, bloqueada)
CREATE OR REPLACE FUNCTION public.notif_emit_view_event(
  _module text,                  -- 'gastos' | 'sueldos'
  _sucursal_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user uuid := auth.uid();
  _org uuid;
  _is_sa boolean;
  _event text;
  _hour text;
  _key text;
  _recipients uuid[];
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  _org := public.get_user_organization_id(_user);
  IF _org IS NULL THEN RETURN; END IF;
  _is_sa := public.has_role(_user, 'sucursal_account'::app_role);
  IF NOT _is_sa THEN RETURN; END IF; -- solo cuenta de sucursal
  IF _module NOT IN ('gastos','sueldos') THEN RAISE EXCEPTION 'Módulo inválido'; END IF;
  IF _sucursal_id IS NULL THEN RETURN; END IF;

  _event := CASE _module WHEN 'gastos' THEN 'visualizacion_gastos' ELSE 'visualizacion_sueldos' END;
  _hour := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD-HH24');
  _key := 'visualizacion:' || _module || ':' || _sucursal_id::text || ':' || _user::text || ':' || _hour;

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(_org) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(_org, _sucursal_id) AS user_id
  ) s;

  PERFORM public._notif_emit_sensitive(
    _org, _event, _key, _sucursal_id,
    'seguridad', 'visualizacion', NULL,
    CASE _module WHEN 'gastos' THEN 'Visualización de gastos' ELSE 'Visualización de sueldos' END,
    'Cuenta de sucursal abrió ' || _module, 'seguridad',
    jsonb_build_object('modulo', _module, 'sucursal_id', _sucursal_id),
    _user, _recipients, true, 'sucursal_account_only'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notif_emit_login_sucursal_account(_sucursal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user uuid := auth.uid();
  _org uuid;
  _key text;
  _recipients uuid[];
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  IF NOT public.has_role(_user, 'sucursal_account'::app_role) THEN RETURN; END IF;
  _org := public.get_user_organization_id(_user);
  IF _org IS NULL OR _sucursal_id IS NULL THEN RETURN; END IF;

  -- dedupe por día
  _key := 'seguridad:login:sucursal:' || _user::text || ':' || to_char(now(), 'YYYY-MM-DD');

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(_org) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(_org, _sucursal_id) AS user_id
  ) s;

  PERFORM public._notif_emit_sensitive(
    _org, 'inicio_sesion_cuenta_sucursal', _key, _sucursal_id,
    'seguridad', 'auth', NULL,
    'Inicio de sesión · Cuenta de sucursal',
    NULL, 'seguridad',
    jsonb_build_object('sucursal_id', _sucursal_id),
    _user, _recipients, false, 'always'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notif_emit_action_blocked(
  _action_key text,
  _sucursal_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user uuid := auth.uid();
  _org uuid;
  _key text;
  _recipients uuid[];
BEGIN
  IF _user IS NULL OR _action_key IS NULL OR length(btrim(_action_key))=0 THEN RETURN; END IF;
  _org := public.get_user_organization_id(_user);
  IF _org IS NULL THEN RETURN; END IF;

  _key := 'seguridad:bloqueada:' || _user::text || ':' || _action_key || ':' || to_char(now(),'YYYY-MM-DD-HH24');

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(_org) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(_org, _sucursal_id) AS user_id
      WHERE _sucursal_id IS NOT NULL
  ) s;

  PERFORM public._notif_emit_sensitive(
    _org, 'accion_bloqueada_permisos', _key, _sucursal_id,
    'seguridad', 'permisos', NULL,
    'Acción bloqueada por permisos', _action_key, 'seguridad',
    jsonb_build_object('action_key', _action_key, 'sucursal_id', _sucursal_id),
    _user, _recipients, false, 'always'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notif_emit_pin_authorized(
  _action_key text,
  _sucursal_id uuid,
  _authorized_by_user_id uuid,
  _authorized_by_name text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user uuid := auth.uid();
  _org uuid;
  _is_sa boolean;
  _key text;
  _recipients uuid[];
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  _is_sa := public.has_role(_user, 'sucursal_account'::app_role);
  IF NOT _is_sa THEN RETURN; END IF;
  IF _action_key IS NULL OR length(btrim(_action_key))=0 THEN RETURN; END IF;
  _org := public.get_user_organization_id(_user);
  IF _org IS NULL THEN RETURN; END IF;

  _key := 'pin:' || _action_key || ':' || COALESCE(_sucursal_id::text,'org') || ':' || extract(epoch from now())::bigint::text;

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(_org) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(_org, _sucursal_id) AS user_id
      WHERE _sucursal_id IS NOT NULL
  ) s;

  INSERT INTO public.notifications (
    organization_id, event_key, type, source_module, source_table, source_id,
    title, body, notification_at, metadata, sucursal_id, category, summary,
    actor_user_id, actor_name, actor_account_type,
    authorized_by_user_id, authorized_by_name
  ) VALUES (
    _org, _key, 'accion_autorizada_pin', 'seguridad', 'pin', NULL,
    'Acción autorizada con PIN', _action_key, now(),
    jsonb_build_object(
      'action_key', _action_key,
      'sucursal_id', _sucursal_id,
      'actor_account_type', 'sucursal_account'
    ),
    _sucursal_id, 'seguridad', _action_key,
    _user, public._notif_actor_name(_user), 'sucursal_account',
    _authorized_by_user_id, _authorized_by_name
  )
  ON CONFLICT (organization_id, event_key) DO NOTHING;

  -- entregar
  INSERT INTO public.notification_deliveries (notification_id, organization_id, user_id)
  SELECT n.id, _org, r
  FROM public.notifications n, unnest(_recipients) r
  WHERE n.organization_id = _org AND n.event_key = _key
    AND r IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = r AND organization_id = _org)
    AND public._notif_pref_mode(r, 'accion_autorizada_pin', 'always') <> 'disabled'
  ON CONFLICT (notification_id, user_id) DO NOTHING;
END;
$$;
