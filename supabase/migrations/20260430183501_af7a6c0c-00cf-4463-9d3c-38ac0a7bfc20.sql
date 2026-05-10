-- Helper privado
CREATE OR REPLACE FUNCTION public._assert_can_write_sucursal_catalog(
  _org_id uuid, _sucursal_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _user_org uuid;
  _suc_org uuid;
  _is_owner boolean;
  _is_gm boolean;
  _is_manager boolean;
  _is_barber boolean;
  _mgr_count int;
  _mgr_suc uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _org_id IS NULL OR _sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos';
  END IF;

  _user_org := public.get_user_organization_id(_uid);
  IF _user_org IS NULL OR _user_org <> _org_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT organization_id INTO _suc_org FROM public.sucursales WHERE id = _sucursal_id;
  IF _suc_org IS NULL OR _suc_org <> _org_id THEN
    RAISE EXCEPTION 'Sucursal inválida';
  END IF;

  _is_owner   := public.has_role(_uid, 'owner'::app_role);
  _is_gm      := public.has_role(_uid, 'general_manager'::app_role);
  _is_manager := public.has_role(_uid, 'manager'::app_role);
  _is_barber  := public.has_role(_uid, 'barber'::app_role);

  IF _is_owner OR _is_gm THEN RETURN; END IF;

  IF _is_barber AND NOT _is_manager THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _is_manager THEN
    SELECT COUNT(DISTINCT us.sucursal_id) INTO _mgr_count
    FROM public.user_sucursales us
    JOIN public.sucursales s ON s.id = us.sucursal_id
    WHERE us.user_id = _uid AND s.organization_id = _org_id;

    IF _mgr_count <> 1 THEN
      RAISE EXCEPTION 'Configuración inválida: el manager debe tener una única sucursal asignada.';
    END IF;

    SELECT us.sucursal_id INTO _mgr_suc
    FROM public.user_sucursales us
    JOIN public.sucursales s ON s.id = us.sucursal_id
    WHERE us.user_id = _uid AND s.organization_id = _org_id
    LIMIT 1;

    IF _mgr_suc IS DISTINCT FROM _sucursal_id THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;
    RETURN;
  END IF;

  RAISE EXCEPTION 'No autorizado';
END;
$$;

REVOKE ALL ON FUNCTION public._assert_can_write_sucursal_catalog(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_can_write_sucursal_catalog(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._assert_can_write_sucursal_catalog(uuid, uuid) FROM authenticated;

-- 1) set_servicio_sucursal_activo
CREATE OR REPLACE FUNCTION public.set_servicio_sucursal_activo(_id uuid, _activo boolean)
RETURNS public.servicios_sucursales
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row public.servicios_sucursales;
BEGIN
  IF _id IS NULL OR _activo IS NULL THEN RAISE EXCEPTION 'Parámetros inválidos'; END IF;
  SELECT * INTO _row FROM public.servicios_sucursales WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Registro no encontrado'; END IF;
  PERFORM public._assert_can_write_sucursal_catalog(_row.organization_id, _row.sucursal_id);
  UPDATE public.servicios_sucursales SET activo = _activo, updated_at = now()
   WHERE id = _row.id RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- 2) set_servicio_sucursal_precio
CREATE OR REPLACE FUNCTION public.set_servicio_sucursal_precio(_id uuid, _precio numeric)
RETURNS public.servicios_sucursales
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row public.servicios_sucursales;
BEGIN
  IF _id IS NULL OR _precio IS NULL THEN RAISE EXCEPTION 'Parámetros inválidos'; END IF;
  IF _precio < 0 THEN RAISE EXCEPTION 'El precio no puede ser negativo'; END IF;
  SELECT * INTO _row FROM public.servicios_sucursales WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Registro no encontrado'; END IF;
  PERFORM public._assert_can_write_sucursal_catalog(_row.organization_id, _row.sucursal_id);
  UPDATE public.servicios_sucursales SET precio = _precio, updated_at = now()
   WHERE id = _row.id RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- 3) set_extra_sucursal_activo
CREATE OR REPLACE FUNCTION public.set_extra_sucursal_activo(_id uuid, _activo boolean)
RETURNS public.extras_sucursales
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row public.extras_sucursales;
BEGIN
  IF _id IS NULL OR _activo IS NULL THEN RAISE EXCEPTION 'Parámetros inválidos'; END IF;
  SELECT * INTO _row FROM public.extras_sucursales WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Registro no encontrado'; END IF;
  PERFORM public._assert_can_write_sucursal_catalog(_row.organization_id, _row.sucursal_id);
  UPDATE public.extras_sucursales SET activo = _activo, updated_at = now()
   WHERE id = _row.id RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- 4) set_extra_sucursal_precio
CREATE OR REPLACE FUNCTION public.set_extra_sucursal_precio(_id uuid, _precio numeric)
RETURNS public.extras_sucursales
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row public.extras_sucursales;
BEGIN
  IF _id IS NULL OR _precio IS NULL THEN RAISE EXCEPTION 'Parámetros inválidos'; END IF;
  IF _precio < 0 THEN RAISE EXCEPTION 'El precio no puede ser negativo'; END IF;
  SELECT * INTO _row FROM public.extras_sucursales WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Registro no encontrado'; END IF;
  PERFORM public._assert_can_write_sucursal_catalog(_row.organization_id, _row.sucursal_id);
  UPDATE public.extras_sucursales SET precio = _precio, updated_at = now()
   WHERE id = _row.id RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- 5) set_descuento_sucursal_activo
CREATE OR REPLACE FUNCTION public.set_descuento_sucursal_activo(_id uuid, _activo boolean)
RETURNS public.descuentos_sucursales
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row public.descuentos_sucursales;
BEGIN
  IF _id IS NULL OR _activo IS NULL THEN RAISE EXCEPTION 'Parámetros inválidos'; END IF;
  SELECT * INTO _row FROM public.descuentos_sucursales WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Registro no encontrado'; END IF;
  PERFORM public._assert_can_write_sucursal_catalog(_row.organization_id, _row.sucursal_id);
  UPDATE public.descuentos_sucursales SET activo = _activo, updated_at = now()
   WHERE id = _row.id RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- Permisos finales
REVOKE ALL ON FUNCTION public.set_servicio_sucursal_activo(uuid, boolean)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_servicio_sucursal_activo(uuid, boolean)   FROM anon;
REVOKE ALL ON FUNCTION public.set_servicio_sucursal_precio(uuid, numeric)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_servicio_sucursal_precio(uuid, numeric)   FROM anon;
REVOKE ALL ON FUNCTION public.set_extra_sucursal_activo(uuid, boolean)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_extra_sucursal_activo(uuid, boolean)      FROM anon;
REVOKE ALL ON FUNCTION public.set_extra_sucursal_precio(uuid, numeric)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_extra_sucursal_precio(uuid, numeric)      FROM anon;
REVOKE ALL ON FUNCTION public.set_descuento_sucursal_activo(uuid, boolean)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_descuento_sucursal_activo(uuid, boolean)  FROM anon;

GRANT EXECUTE ON FUNCTION public.set_servicio_sucursal_activo(uuid, boolean)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_servicio_sucursal_precio(uuid, numeric)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_extra_sucursal_activo(uuid, boolean)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_extra_sucursal_precio(uuid, numeric)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_descuento_sucursal_activo(uuid, boolean)  TO authenticated;