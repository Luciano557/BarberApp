
-- 1) Columna de duplicado potencial
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS posible_duplicado_de uuid NULL
  REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_posible_duplicado_de
  ON public.clientes(posible_duplicado_de) WHERE posible_duplicado_de IS NOT NULL;

-- 2) RPC: buscar cliente por teléfono en la organización del usuario autenticado
CREATE OR REPLACE FUNCTION public.find_cliente_by_phone_in_org(
  _telefono text,
  _organization_id uuid
)
RETURNS TABLE (
  cliente_id uuid,
  nombre text,
  apellido text,
  telefono text,
  email text,
  eliminado boolean,
  sucursales jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_org uuid;
  _tel text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _user_org := public.get_user_organization_id(_user_id);
  IF _user_org IS NULL OR _user_org <> _organization_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _tel := NULLIF(btrim(COALESCE(_telefono, '')), '');
  IF _tel IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.nombre,
    c.apellido,
    c.telefono,
    c.email,
    c.eliminado,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('sucursal_id', s.id, 'nombre', s.nombre) ORDER BY s.nombre)
        FROM public.clientes_sucursales cs
        JOIN public.sucursales s ON s.id = cs.sucursal_id
        WHERE cs.cliente_id = c.id AND cs.organization_id = _user_org
      ),
      '[]'::jsonb
    ) AS sucursales
  FROM public.clientes c
  WHERE c.organization_id = _user_org
    AND c.telefono = _tel
    AND c.eliminado = false
  ORDER BY c.created_at ASC
  LIMIT 5;
END;
$$;

REVOKE ALL ON FUNCTION public.find_cliente_by_phone_in_org(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_cliente_by_phone_in_org(text, uuid) TO authenticated;

-- 3) RPC: vincular cliente existente a una sucursal (valida misma organización)
CREATE OR REPLACE FUNCTION public.link_cliente_to_sucursal(
  _cliente_id uuid,
  _sucursal_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _cli_org uuid;
  _suc_org uuid;
  _is_owner_or_gm boolean;
  _is_manager_or_barber boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _org_id := public.get_user_organization_id(_user_id);
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _is_owner_or_gm := public.has_role(_user_id, 'owner'::app_role)
                  OR public.has_role(_user_id, 'general_manager'::app_role);
  _is_manager_or_barber := public.has_role(_user_id, 'manager'::app_role)
                        OR public.has_role(_user_id, 'barber'::app_role);

  IF NOT (_is_owner_or_gm OR _is_manager_or_barber) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT organization_id INTO _cli_org FROM public.clientes WHERE id = _cliente_id;
  IF _cli_org IS NULL OR _cli_org <> _org_id THEN
    RAISE EXCEPTION 'Cliente no encontrado en la organización';
  END IF;

  SELECT organization_id INTO _suc_org FROM public.sucursales WHERE id = _sucursal_id;
  IF _suc_org IS NULL OR _suc_org <> _org_id THEN
    RAISE EXCEPTION 'Sucursal no valida';
  END IF;

  IF NOT _is_owner_or_gm THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_sucursales
      WHERE user_id = _user_id AND sucursal_id = _sucursal_id
    ) THEN
      RAISE EXCEPTION 'Sucursal no valida';
    END IF;
  END IF;

  INSERT INTO public.clientes_sucursales (organization_id, cliente_id, sucursal_id, origen_relacion)
  VALUES (_org_id, _cliente_id, _sucursal_id, 'manual')
  ON CONFLICT (cliente_id, sucursal_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.link_cliente_to_sucursal(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_cliente_to_sucursal(uuid, uuid) TO authenticated;

-- 4) Actualizar create_cliente_with_sucursal para aceptar posible_duplicado_de
CREATE OR REPLACE FUNCTION public.create_cliente_with_sucursal(
  _nombre text,
  _apellido text DEFAULT NULL::text,
  _sucursal_id uuid DEFAULT NULL::uuid,
  _telefono text DEFAULT NULL::text,
  _email text DEFAULT NULL::text,
  _instagram text DEFAULT NULL::text,
  _tiktok text DEFAULT NULL::text,
  _otra_red_social text DEFAULT NULL::text,
  _fecha_nacimiento date DEFAULT NULL::date,
  _alergias text DEFAULT NULL::text,
  _acepta_marketing boolean DEFAULT true,
  _posible_duplicado_de uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _suc_org_id uuid;
  _cliente_id uuid;
  _is_owner_or_gm boolean;
  _is_manager_or_barber boolean;
  _tel text;
  _mail text;
  _dup_org uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _org_id := public.get_user_organization_id(_user_id);
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _is_owner_or_gm := public.has_role(_user_id, 'owner'::app_role)
                  OR public.has_role(_user_id, 'general_manager'::app_role);
  _is_manager_or_barber := public.has_role(_user_id, 'manager'::app_role)
                        OR public.has_role(_user_id, 'barber'::app_role);

  IF NOT (_is_owner_or_gm OR _is_manager_or_barber) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Sucursal no valida';
  END IF;

  SELECT organization_id INTO _suc_org_id
  FROM public.sucursales
  WHERE id = _sucursal_id;

  IF _suc_org_id IS NULL OR _suc_org_id <> _org_id THEN
    RAISE EXCEPTION 'Sucursal no valida';
  END IF;

  IF NOT _is_owner_or_gm THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_sucursales
      WHERE user_id = _user_id AND sucursal_id = _sucursal_id
    ) THEN
      RAISE EXCEPTION 'Sucursal no valida';
    END IF;
  END IF;

  IF _nombre IS NULL OR length(btrim(_nombre)) = 0 THEN
    RAISE EXCEPTION 'Nombre obligatorio';
  END IF;

  _tel := NULLIF(btrim(COALESCE(_telefono, '')), '');
  _mail := NULLIF(btrim(COALESCE(_email, '')), '');
  IF _tel IS NULL AND _mail IS NULL THEN
    RAISE EXCEPTION 'Teléfono o email obligatorio';
  END IF;

  IF _posible_duplicado_de IS NOT NULL THEN
    SELECT organization_id INTO _dup_org FROM public.clientes WHERE id = _posible_duplicado_de;
    IF _dup_org IS NULL OR _dup_org <> _org_id THEN
      RAISE EXCEPTION 'Referencia de duplicado inválida';
    END IF;
  END IF;

  INSERT INTO public.clientes (
    organization_id,
    nombre,
    apellido,
    telefono,
    email,
    origen,
    instagram,
    tiktok,
    otra_red_social,
    fecha_nacimiento,
    alergias,
    acepta_marketing,
    posible_duplicado_de
  )
  VALUES (
    _org_id,
    btrim(_nombre),
    NULLIF(btrim(COALESCE(_apellido, '')), ''),
    _tel,
    _mail,
    'manual',
    NULLIF(btrim(COALESCE(_instagram, '')), ''),
    NULLIF(btrim(COALESCE(_tiktok, '')), ''),
    NULLIF(btrim(COALESCE(_otra_red_social, '')), ''),
    _fecha_nacimiento,
    NULLIF(btrim(COALESCE(_alergias, '')), ''),
    COALESCE(_acepta_marketing, true),
    _posible_duplicado_de
  )
  RETURNING id INTO _cliente_id;

  INSERT INTO public.clientes_sucursales (organization_id, cliente_id, sucursal_id, origen_relacion)
  VALUES (_org_id, _cliente_id, _sucursal_id, 'manual');

  RETURN _cliente_id;
END;
$function$;
