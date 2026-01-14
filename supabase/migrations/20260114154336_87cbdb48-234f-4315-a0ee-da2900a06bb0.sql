-- Add timezone column to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires';

-- Update the handle_new_user function to map country to timezone
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  org_slug TEXT;
  user_country TEXT;
  user_timezone TEXT;
BEGIN
  -- Obtener nombre del negocio desde metadata o usar default
  org_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mi Barbería');
  org_slug := LOWER(REPLACE(org_name, ' ', '-')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);
  
  -- Obtener país y mapear a zona horaria
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
  
  -- Crear organización con timezone
  INSERT INTO public.organizations (name, slug, plan, timezone)
  VALUES (org_name, org_slug, 'free', user_timezone)
  RETURNING id INTO new_org_id;
  
  -- Crear perfil vinculado a la organización
  INSERT INTO public.profiles (id, email, full_name, organization_id)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    new_org_id
  );
  
  -- Asignar rol de owner (el creador siempre es owner de su negocio)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  
  RETURN NEW;
END;
$function$;