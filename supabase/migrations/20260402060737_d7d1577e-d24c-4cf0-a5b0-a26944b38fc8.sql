
-- Fix handle_new_user: skip org/owner creation for invited users
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
  invited_by_id UUID;
BEGIN
  -- Check if this is an invited user
  invited_by_id := (NEW.raw_user_meta_data->>'invited_by')::UUID;

  IF invited_by_id IS NOT NULL THEN
    -- Invited user: only create profile, everything else is handled by invite-user function
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
  END IF;

  -- Self-registered user: create org, sucursal, profile, owner role, user_sucursales
  org_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mi Barbería');
  org_slug := LOWER(REPLACE(org_name, ' ', '-')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);
  user_country := COALESCE(NEW.raw_user_meta_data->>'country', 'AR');
  
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
  
  INSERT INTO public.organizations (name, slug, plan, timezone)
  VALUES (org_name, org_slug, 'free', user_timezone)
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

-- Cleanup: remove spurious 'owner' roles from invited users who have another role
DELETE FROM public.user_roles
WHERE role = 'owner'
  AND user_id IN (
    SELECT ur1.user_id
    FROM public.user_roles ur1
    WHERE ur1.role = 'owner'
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur2
        WHERE ur2.user_id = ur1.user_id
          AND ur2.role != 'owner'
      )
      AND ur1.user_id IN (
        SELECT id FROM auth.users
        WHERE raw_user_meta_data->>'invited_by' IS NOT NULL
      )
  );
