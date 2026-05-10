-- Add import-related columns to clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS fecha_cliente_desde date,
  ADD COLUMN IF NOT EXISTS fecha_importacion timestamptz;

-- Batch import RPC: validates permissions, inserts clientes + clientes_sucursales atomically
CREATE OR REPLACE FUNCTION public.import_clientes_with_sucursal(
  _sucursal_id uuid,
  _clientes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _uid uuid := auth.uid();
  _row jsonb;
  _new_cliente_id uuid;
  _inserted int := 0;
  _errors jsonb := '[]'::jsonb;
  _idx int := 0;
  _nombre text;
  _apellido text;
  _telefono text;
  _email text;
  _fecha_nac date;
  _fecha_desde date;
  _is_authorized boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  _org_id := public.get_user_organization_id(_uid);
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  -- Validate sucursal belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM public.sucursales
    WHERE id = _sucursal_id AND organization_id = _org_id
  ) THEN
    RAISE EXCEPTION 'Sucursal inválida';
  END IF;

  -- Permission check: owner/GM full org; manager/barber only own sucursales
  IF public.has_role(_uid, 'owner'::app_role) OR public.has_role(_uid, 'general_manager'::app_role) THEN
    _is_authorized := true;
  ELSIF (public.has_role(_uid, 'manager'::app_role) OR public.has_role(_uid, 'barber'::app_role)) THEN
    IF _sucursal_id IN (SELECT public.get_user_sucursal_ids(_uid)) THEN
      _is_authorized := true;
    END IF;
  END IF;

  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Sin permiso para importar a esta sucursal';
  END IF;

  IF jsonb_typeof(_clientes) <> 'array' THEN
    RAISE EXCEPTION 'Formato inválido: se esperaba un array';
  END IF;

  FOR _row IN SELECT * FROM jsonb_array_elements(_clientes) LOOP
    _idx := _idx + 1;
    BEGIN
      _nombre := trim(coalesce(_row->>'nombre', ''));
      _apellido := trim(coalesce(_row->>'apellido', ''));
      _telefono := nullif(trim(coalesce(_row->>'telefono', '')), '');
      _email := nullif(lower(trim(coalesce(_row->>'email', ''))), '');

      IF _nombre = '' THEN
        _errors := _errors || jsonb_build_object('index', _idx, 'error', 'Nombre requerido');
        CONTINUE;
      END IF;
      IF _apellido = '' THEN
        _apellido := '-';
      END IF;

      _fecha_nac := NULL;
      IF (_row->>'fecha_nacimiento') IS NOT NULL AND length(_row->>'fecha_nacimiento') > 0 THEN
        BEGIN _fecha_nac := (_row->>'fecha_nacimiento')::date; EXCEPTION WHEN OTHERS THEN _fecha_nac := NULL; END;
      END IF;

      _fecha_desde := NULL;
      IF (_row->>'fecha_cliente_desde') IS NOT NULL AND length(_row->>'fecha_cliente_desde') > 0 THEN
        BEGIN _fecha_desde := (_row->>'fecha_cliente_desde')::date; EXCEPTION WHEN OTHERS THEN _fecha_desde := NULL; END;
      END IF;

      INSERT INTO public.clientes (
        organization_id, nombre, apellido, telefono, email,
        fecha_nacimiento, instagram, tiktok, otra_red_social,
        alergias, nota_interna, acepta_marketing,
        origen, fecha_cliente_desde, fecha_importacion
      ) VALUES (
        _org_id, _nombre, _apellido, _telefono, _email,
        _fecha_nac,
        nullif(trim(coalesce(_row->>'instagram','')), ''),
        nullif(trim(coalesce(_row->>'tiktok','')), ''),
        nullif(trim(coalesce(_row->>'otra_red_social','')), ''),
        nullif(trim(coalesce(_row->>'alergias','')), ''),
        nullif(trim(coalesce(_row->>'nota_interna','')), ''),
        coalesce((_row->>'acepta_marketing')::boolean, true),
        'importado',
        _fecha_desde,
        now()
      )
      RETURNING id INTO _new_cliente_id;

      INSERT INTO public.clientes_sucursales (cliente_id, sucursal_id, organization_id, origen_relacion)
      VALUES (_new_cliente_id, _sucursal_id, _org_id, 'importado');

      _inserted := _inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      _errors := _errors || jsonb_build_object('index', _idx, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', _inserted,
    'errors', _errors,
    'total', _idx
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_clientes_with_sucursal(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_clientes_with_sucursal(uuid, jsonb) TO authenticated;