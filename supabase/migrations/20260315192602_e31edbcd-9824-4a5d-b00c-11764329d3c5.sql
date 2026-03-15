
-- 1. Create tables first (no RLS policies yet)
CREATE TABLE public.sucursales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  direccion text,
  telefono text,
  timezone text,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_sucursales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, sucursal_id)
);

-- 2. Enable RLS
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sucursales ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies (now both tables exist)
CREATE POLICY "Owner full access sucursales"
  ON public.sucursales FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Manager can view assigned sucursales"
  ON public.sucursales FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) 
    AND has_role(auth.uid(), 'manager'::app_role)
    AND id IN (SELECT sucursal_id FROM public.user_sucursales WHERE user_id = auth.uid()));

CREATE POLICY "Barber can view assigned sucursales"
  ON public.sucursales FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) 
    AND has_role(auth.uid(), 'barber'::app_role)
    AND id IN (SELECT sucursal_id FROM public.user_sucursales WHERE user_id = auth.uid()));

CREATE POLICY "Owner full access user_sucursales"
  ON public.user_sucursales FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Users can view own sucursal memberships"
  ON public.user_sucursales FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4. Helper function
CREATE OR REPLACE FUNCTION public.get_user_sucursal_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sucursal_id FROM public.user_sucursales WHERE user_id = _user_id
$$;

-- 5. Add sucursal_id to operational tables
ALTER TABLE public.barberos ADD COLUMN sucursal_id uuid REFERENCES public.sucursales(id);
ALTER TABLE public.venta ADD COLUMN sucursal_id uuid REFERENCES public.sucursales(id);
ALTER TABLE public.ingresos ADD COLUMN sucursal_id uuid REFERENCES public.sucursales(id);
ALTER TABLE public.ingresos_items ADD COLUMN sucursal_id uuid REFERENCES public.sucursales(id);
ALTER TABLE public."Egresos" ADD COLUMN sucursal_id uuid REFERENCES public.sucursales(id);
ALTER TABLE public.pagos_sueldos ADD COLUMN sucursal_id uuid REFERENCES public.sucursales(id);
ALTER TABLE public.inversiones ADD COLUMN sucursal_id uuid REFERENCES public.sucursales(id);
ALTER TABLE public.deudas ADD COLUMN sucursal_id uuid REFERENCES public.sucursales(id);
ALTER TABLE public.tareas ADD COLUMN sucursal_id uuid REFERENCES public.sucursales(id);
ALTER TABLE public."ReportesMensuales" ADD COLUMN sucursal_id uuid REFERENCES public.sucursales(id);

-- 6. Add default_sucursal_id to profiles
ALTER TABLE public.profiles ADD COLUMN default_sucursal_id uuid REFERENCES public.sucursales(id);

-- 7. Update handle_new_user trigger
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
BEGIN
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

-- 8. Backfill existing orgs with default sucursal
DO $$
DECLARE
  org RECORD;
  new_suc_id UUID;
BEGIN
  FOR org IN SELECT id, timezone FROM public.organizations LOOP
    INSERT INTO public.sucursales (organization_id, nombre, timezone)
    VALUES (org.id, 'Casa Central', COALESCE(org.timezone, 'America/Argentina/Buenos_Aires'))
    RETURNING id INTO new_suc_id;

    INSERT INTO public.user_sucursales (user_id, sucursal_id, organization_id)
    SELECT p.id, new_suc_id, org.id
    FROM public.profiles p WHERE p.organization_id = org.id;

    UPDATE public.profiles SET default_sucursal_id = new_suc_id WHERE organization_id = org.id;
    UPDATE public.barberos SET sucursal_id = new_suc_id WHERE organization_id = org.id AND sucursal_id IS NULL;
    UPDATE public.venta SET sucursal_id = new_suc_id WHERE organization_id = org.id AND sucursal_id IS NULL;
    UPDATE public.ingresos SET sucursal_id = new_suc_id WHERE organization_id = org.id AND sucursal_id IS NULL;
    UPDATE public.ingresos_items SET sucursal_id = new_suc_id WHERE organization_id = org.id AND sucursal_id IS NULL;
    UPDATE public."Egresos" SET sucursal_id = new_suc_id WHERE organization_id = org.id AND sucursal_id IS NULL;
    UPDATE public.pagos_sueldos SET sucursal_id = new_suc_id WHERE organization_id = org.id AND sucursal_id IS NULL;
    UPDATE public.inversiones SET sucursal_id = new_suc_id WHERE organization_id = org.id AND sucursal_id IS NULL;
    UPDATE public.deudas SET sucursal_id = new_suc_id WHERE organization_id = org.id AND sucursal_id IS NULL;
    UPDATE public.tareas SET sucursal_id = new_suc_id WHERE organization_id = org.id AND sucursal_id IS NULL;
    UPDATE public."ReportesMensuales" SET sucursal_id = new_suc_id WHERE organization_id = org.id AND sucursal_id IS NULL;
  END LOOP;
END $$;
