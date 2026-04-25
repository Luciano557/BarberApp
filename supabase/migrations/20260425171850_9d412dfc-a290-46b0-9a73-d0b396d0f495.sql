-- Extender clientes con campos sociales/personales/estado
ALTER TABLE public.clientes
  ADD COLUMN instagram text NULL,
  ADD COLUMN tiktok text NULL,
  ADD COLUMN otra_red_social text NULL,
  ADD COLUMN fecha_nacimiento date NULL,
  ADD COLUMN alergias text NULL,
  ADD COLUMN acepta_marketing boolean NOT NULL DEFAULT true,
  ADD COLUMN bloqueado boolean NOT NULL DEFAULT false,
  ADD COLUMN motivo_bloqueo text NULL;

-- Reemplazar RPC de creación atómica con nueva firma (campos opcionales)
DROP FUNCTION IF EXISTS public.create_cliente_with_sucursal(text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.create_cliente_with_sucursal(
  _nombre text,
  _apellido text,
  _sucursal_id uuid,
  _telefono text DEFAULT NULL,
  _email text DEFAULT NULL,
  _instagram text DEFAULT NULL,
  _tiktok text DEFAULT NULL,
  _otra_red_social text DEFAULT NULL,
  _fecha_nacimiento date DEFAULT NULL,
  _alergias text DEFAULT NULL,
  _acepta_marketing boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _suc_org_id uuid;
  _cliente_id uuid;
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
  IF _apellido IS NULL OR length(btrim(_apellido)) = 0 THEN
    RAISE EXCEPTION 'Apellido obligatorio';
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
    acepta_marketing
  )
  VALUES (
    _org_id,
    btrim(_nombre),
    btrim(_apellido),
    NULLIF(btrim(COALESCE(_telefono, '')), ''),
    NULLIF(btrim(COALESCE(_email, '')), ''),
    'manual',
    NULLIF(btrim(COALESCE(_instagram, '')), ''),
    NULLIF(btrim(COALESCE(_tiktok, '')), ''),
    NULLIF(btrim(COALESCE(_otra_red_social, '')), ''),
    _fecha_nacimiento,
    NULLIF(btrim(COALESCE(_alergias, '')), ''),
    COALESCE(_acepta_marketing, true)
  )
  RETURNING id INTO _cliente_id;

  INSERT INTO public.clientes_sucursales (organization_id, cliente_id, sucursal_id, origen_relacion)
  VALUES (_org_id, _cliente_id, _sucursal_id, 'manual');

  RETURN _cliente_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.create_cliente_with_sucursal(
  text, text, uuid, text, text, text, text, text, date, text, boolean
) TO authenticated;