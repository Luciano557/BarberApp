
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;

UPDATE public.organizations SET plan = 'basico'      WHERE plan = 'free';
UPDATE public.organizations SET plan = 'profesional' WHERE plan = 'basic';

ALTER TABLE public.organizations ALTER COLUMN plan SET DEFAULT 'basico';

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('basico','profesional','premium'));

UPDATE public.plan_features SET plan = 'basico',      price_monthly = 30000  WHERE plan = 'free';
UPDATE public.plan_features SET plan = 'profesional', price_monthly = 50000  WHERE plan = 'basic';
UPDATE public.plan_features SET                       price_monthly = 100000 WHERE plan = 'premium';

UPDATE public.organizations
   SET plan_expires_at = COALESCE(plan_expires_at, created_at + interval '30 days'),
       last_payment_at = COALESCE(last_payment_at, created_at);

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
BEGIN
  invited_by_id := (NEW.raw_user_meta_data->>'invited_by')::UUID;

  IF invited_by_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
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

  INSERT INTO public.profiles (id, email, full_name, organization_id, default_sucursal_id)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), new_org_id, new_sucursal_id);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');

  INSERT INTO public.user_sucursales (user_id, sucursal_id, organization_id)
  VALUES (NEW.id, new_sucursal_id, new_org_id);

  RETURN NEW;
END;
$function$;
