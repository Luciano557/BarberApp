
-- 1) Backfill: crear fila barberos para cada org cuyo owner no la tenga.
WITH owners AS (
  SELECT p.id AS user_id, p.organization_id, p.full_name, p.email
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'owner'::app_role
  WHERE p.organization_id IS NOT NULL
),
owners_sin_ficha AS (
  SELECT DISTINCT ON (o.organization_id) o.*
  FROM owners o
  WHERE NOT EXISTS (
    SELECT 1 FROM public.barberos b
    WHERE b.organization_id = o.organization_id
      AND (b.rol_equipo = 'owner' OR 'owner' = ANY(COALESCE(b.roles_equipo, ARRAY[]::text[])))
  )
  ORDER BY o.organization_id, o.user_id
)
INSERT INTO public.barberos (
  organization_id, nombre, apellido, sucursal_id, comision,
  tipo_compensacion, rol_equipo, roles_equipo, fecha_cobro_dia, activo
)
SELECT
  o.organization_id,
  CASE
    WHEN o.full_name IS NULL OR btrim(o.full_name) = ''
      THEN COALESCE(o.email, 'Dueño')
    WHEN position(' ' IN btrim(o.full_name)) = 0
      THEN btrim(o.full_name)
    ELSE split_part(btrim(o.full_name), ' ', 1)
  END,
  CASE
    WHEN o.full_name IS NULL OR btrim(o.full_name) = '' THEN ''
    WHEN position(' ' IN btrim(o.full_name)) = 0 THEN ''
    ELSE btrim(substring(btrim(o.full_name) FROM position(' ' IN btrim(o.full_name)) + 1))
  END,
  NULL, 0, 'comision', 'owner', ARRAY['owner']::text[], 1, true
FROM owners_sin_ficha o;

-- Link profiles.barbero_id (nuevo o existente) para owners donde quedó NULL.
UPDATE public.profiles p
SET barbero_id = (
  SELECT b.id FROM public.barberos b
  WHERE b.organization_id = p.organization_id
    AND (b.rol_equipo = 'owner' OR 'owner' = ANY(COALESCE(b.roles_equipo, ARRAY[]::text[])))
  ORDER BY b.created_at ASC
  LIMIT 1
)
WHERE p.barbero_id IS NULL
  AND p.organization_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'owner'::app_role
  );

-- 2) Trigger de protección de la fila owner.
CREATE OR REPLACE FUNCTION public.trg_barberos_protect_owner_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _ref public.barberos%ROWTYPE;
  _is_owner_row boolean;
  _owner_user uuid;
  _caller uuid := auth.uid();
  _caller_is_owner_in_org boolean;
BEGIN
  _ref := OLD;

  _is_owner_row := (
    _ref.rol_equipo = 'owner'
    OR 'owner' = ANY(COALESCE(_ref.roles_equipo, ARRAY[]::text[]))
  );

  IF NOT COALESCE(_is_owner_row, false) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(NEW.activo, true) = false THEN
    RAISE EXCEPTION 'El dueño no puede desactivarse'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.id INTO _owner_user
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'owner'::app_role
  WHERE p.organization_id = _ref.organization_id
    AND p.barbero_id = _ref.id
  LIMIT 1;

  IF _owner_user IS NOT NULL THEN
    IF _caller IS NULL OR _caller <> _owner_user THEN
      RAISE EXCEPTION 'Solo el dueño puede modificar su propia ficha'
        USING ERRCODE = '42501';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Fallback resiliente.
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Solo el dueño puede modificar su propia ficha'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _caller
      AND ur.role = 'owner'::app_role
      AND p.organization_id = _ref.organization_id
  ) INTO _caller_is_owner_in_org;

  IF NOT _caller_is_owner_in_org THEN
    RAISE EXCEPTION 'Solo el dueño puede modificar su propia ficha'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_barberos_protect_owner_row_upd ON public.barberos;
CREATE TRIGGER trg_barberos_protect_owner_row_upd
BEFORE UPDATE ON public.barberos
FOR EACH ROW EXECUTE FUNCTION public.trg_barberos_protect_owner_row();

DROP TRIGGER IF EXISTS trg_barberos_protect_owner_row_del ON public.barberos;
CREATE TRIGGER trg_barberos_protect_owner_row_del
BEFORE DELETE ON public.barberos
FOR EACH ROW EXECUTE FUNCTION public.trg_barberos_protect_owner_row();

-- 3) Provisión automática para orgs nuevas: extender handle_new_user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  new_sucursal_id UUID;
  org_name TEXT;
  org_slug TEXT;
  user_country TEXT;
  user_timezone TEXT;
  user_plan TEXT;
  invited_by_id UUID;
  is_sucursal_acc BOOLEAN;
  owner_full_name TEXT;
  owner_nombre TEXT;
  owner_apellido TEXT;
  new_barbero_id UUID;
BEGIN
  invited_by_id := (NEW.raw_user_meta_data->>'invited_by')::UUID;
  is_sucursal_acc := COALESCE((NEW.raw_user_meta_data->>'sucursal_account')::boolean, false);

  IF is_sucursal_acc THEN
    RETURN NEW;
  END IF;

  IF invited_by_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    RETURN NEW;
  END IF;

  org_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mi Barbería');
  org_slug := LOWER(REPLACE(org_name, ' ', '-')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);
  user_country := COALESCE(NEW.raw_user_meta_data->>'country', 'AR');

  user_plan := LOWER(COALESCE(NEW.raw_user_meta_data->>'business_plan', 'basico'));
  IF user_plan NOT IN ('basico','profesional','premium') THEN
    user_plan := 'basico';
  END IF;

  user_timezone := CASE user_country
    WHEN 'AR' THEN 'America/Argentina/Buenos_Aires'
    WHEN 'MX' THEN 'America/Mexico_City'
    WHEN 'CO' THEN 'America/Bogota'
    WHEN 'CL' THEN 'America/Santiago'
    WHEN 'PE' THEN 'America/Lima'
    WHEN 'EC' THEN 'America/Guayaquil'
    WHEN 'UY' THEN 'America/Montevideo'
    WHEN 'PY' THEN 'America/Asuncion'
    WHEN 'BO' THEN 'America/La_Paz'
    WHEN 'VE' THEN 'America/Caracas'
    WHEN 'ES' THEN 'Europe/Madrid'
    WHEN 'BR' THEN 'America/Sao_Paulo'
    WHEN 'CR' THEN 'America/Costa_Rica'
    WHEN 'PA' THEN 'America/Panama'
    WHEN 'DO' THEN 'America/Santo_Domingo'
    WHEN 'GT' THEN 'America/Guatemala'
    WHEN 'HN' THEN 'America/Tegucigalpa'
    WHEN 'SV' THEN 'America/El_Salvador'
    WHEN 'NI' THEN 'America/Managua'
    WHEN 'PR' THEN 'America/Puerto_Rico'
    WHEN 'CU' THEN 'America/Havana'
    ELSE 'America/Argentina/Buenos_Aires'
  END;

  INSERT INTO public.organizations (name, slug, plan, timezone, plan_expires_at, last_payment_at)
  VALUES (org_name, org_slug, user_plan, user_timezone, now() + interval '30 days', now())
  RETURNING id INTO new_org_id;

  INSERT INTO public.sucursales (organization_id, nombre, timezone)
  VALUES (new_org_id, 'Casa Central', user_timezone)
  RETURNING id INTO new_sucursal_id;

  owner_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  IF btrim(owner_full_name) = '' THEN
    owner_nombre := COALESCE(NEW.email, 'Dueño');
    owner_apellido := '';
  ELSIF position(' ' IN btrim(owner_full_name)) = 0 THEN
    owner_nombre := btrim(owner_full_name);
    owner_apellido := '';
  ELSE
    owner_nombre := split_part(btrim(owner_full_name), ' ', 1);
    owner_apellido := btrim(substring(btrim(owner_full_name) FROM position(' ' IN btrim(owner_full_name)) + 1));
  END IF;

  INSERT INTO public.barberos (
    organization_id, nombre, apellido, sucursal_id, comision,
    tipo_compensacion, rol_equipo, roles_equipo, fecha_cobro_dia, activo
  ) VALUES (
    new_org_id, owner_nombre, owner_apellido, NULL, 0,
    'comision', 'owner', ARRAY['owner']::text[], 1, true
  )
  RETURNING id INTO new_barbero_id;

  INSERT INTO public.profiles (id, email, full_name, organization_id, default_sucursal_id, barbero_id)
  VALUES (NEW.id, NEW.email, owner_full_name, new_org_id, new_sucursal_id, new_barbero_id);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');

  INSERT INTO public.user_sucursales (user_id, sucursal_id, organization_id)
  VALUES (NEW.id, new_sucursal_id, new_org_id);

  RETURN NEW;
END;
$function$;
