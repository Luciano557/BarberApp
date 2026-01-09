-- =============================================
-- FASE 1: CREAR TABLA DE ORGANIZACIONES
-- =============================================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'premium')),
  plan_expires_at TIMESTAMPTZ,
  logo_url TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FASE 2: TABLA DE CARACTERÍSTICAS POR PLAN
-- =============================================

CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT UNIQUE NOT NULL,
  max_barbers INTEGER DEFAULT 2,
  max_services INTEGER DEFAULT 10,
  can_export_reports BOOLEAN DEFAULT false,
  can_view_analytics BOOLEAN DEFAULT false,
  price_monthly NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar planes por defecto
INSERT INTO public.plan_features (plan, max_barbers, max_services, can_export_reports, can_view_analytics, price_monthly) VALUES
  ('free', 2, 10, false, false, 0),
  ('basic', 5, 50, true, true, 9.99),
  ('premium', 999, 999, true, true, 29.99);

-- =============================================
-- FASE 3: AGREGAR organization_id A TODAS LAS TABLAS
-- =============================================

-- Profiles
ALTER TABLE public.profiles 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Barberos
ALTER TABLE public.barberos 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Servicios
ALTER TABLE public.servicios 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Lineas
ALTER TABLE public.lineas 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Extras
ALTER TABLE public.extras 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Descuentos
ALTER TABLE public.descuentos 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Venta
ALTER TABLE public.venta 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Ingresos
ALTER TABLE public.ingresos 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Egresos
ALTER TABLE public."Egresos" 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ReportesMensuales
ALTER TABLE public."ReportesMensuales" 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- =============================================
-- FASE 4: FUNCIONES HELPER PARA MULTI-TENANT
-- =============================================

-- Obtener organization_id del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;

-- Verificar si usuario pertenece a una organización
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = _user_id AND organization_id = _org_id
  )
$$;

-- Verificar límites del plan
CREATE OR REPLACE FUNCTION public.check_org_limit(_org_id UUID, _resource TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_plan TEXT;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT plan INTO current_plan FROM organizations WHERE id = _org_id;
  
  IF _resource = 'barbers' THEN
    SELECT COUNT(*) INTO current_count FROM barberos WHERE organization_id = _org_id AND activo = true;
    SELECT max_barbers INTO max_allowed FROM plan_features WHERE plan = current_plan;
  ELSIF _resource = 'services' THEN
    SELECT COUNT(*) INTO current_count FROM servicios WHERE organization_id = _org_id AND activo = true;
    SELECT max_services INTO max_allowed FROM plan_features WHERE plan = current_plan;
  ELSE
    RETURN true;
  END IF;
  
  RETURN current_count < max_allowed;
END;
$$;

-- =============================================
-- FASE 5: MIGRAR DATOS EXISTENTES A ORGANIZACIÓN "Scissors"
-- =============================================

-- Crear organización Scissors para datos existentes
INSERT INTO public.organizations (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Scissors', 'scissors', 'premium');

-- Migrar todos los datos existentes a Scissors
UPDATE public.profiles SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.barberos SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.servicios SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.lineas SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.extras SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.descuentos SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.venta SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.ingresos SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public."Egresos" SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public."ReportesMensuales" SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- =============================================
-- FASE 6: ACTUALIZAR TRIGGER DE NUEVO USUARIO
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  -- Obtener nombre del negocio desde metadata o usar default
  org_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mi Barbería');
  org_slug := LOWER(REPLACE(org_name, ' ', '-')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);
  
  -- Crear organización
  INSERT INTO public.organizations (name, slug, plan)
  VALUES (org_name, org_slug, 'free')
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
$$;

-- =============================================
-- FASE 7: POLÍTICAS RLS PARA ORGANIZATIONS
-- =============================================

-- Los usuarios pueden ver su propia organización
CREATE POLICY "Users can view own organization"
ON public.organizations FOR SELECT
USING (id = get_user_organization_id(auth.uid()));

-- Owners pueden actualizar su organización
CREATE POLICY "Owner can update own organization"
ON public.organizations FOR UPDATE
USING (
  id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner')
)
WITH CHECK (
  id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner')
);

-- =============================================
-- FASE 8: ACTUALIZAR POLÍTICAS RLS EXISTENTES
-- =============================================

-- BARBEROS: Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Authenticated can view barberos" ON public.barberos;
DROP POLICY IF EXISTS "Owner can modify barberos" ON public.barberos;

CREATE POLICY "Users can view own org barberos"
ON public.barberos FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owner can modify own org barberos"
ON public.barberos FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner')
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner')
);

-- SERVICIOS: Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Authenticated can view servicios" ON public.servicios;
DROP POLICY IF EXISTS "Owner and manager can modify servicios" ON public.servicios;

CREATE POLICY "Users can view own org servicios"
ON public.servicios FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owner and manager can modify own org servicios"
ON public.servicios FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- LINEAS: Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Authenticated can view lineas" ON public.lineas;
DROP POLICY IF EXISTS "Owner and manager can modify lineas" ON public.lineas;

CREATE POLICY "Users can view own org lineas"
ON public.lineas FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owner and manager can modify own org lineas"
ON public.lineas FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- EXTRAS: Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Authenticated can view extras" ON public.extras;
DROP POLICY IF EXISTS "Owner and manager can modify extras" ON public.extras;

CREATE POLICY "Users can view own org extras"
ON public.extras FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owner and manager can modify own org extras"
ON public.extras FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- DESCUENTOS: Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Authenticated can view descuentos" ON public.descuentos;
DROP POLICY IF EXISTS "Owner and manager can modify descuentos" ON public.descuentos;

CREATE POLICY "Users can view own org descuentos"
ON public.descuentos FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owner and manager can modify own org descuentos"
ON public.descuentos FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- VENTA: Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Owner and manager can do all on venta" ON public.venta;
DROP POLICY IF EXISTS "Barber can view own venta" ON public.venta;

CREATE POLICY "Owner and manager can do all on own org venta"
ON public.venta FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Barber can view own org venta"
ON public.venta FOR SELECT
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber') 
  AND barbero_id = get_user_barbero_id(auth.uid())
);

-- VENTA_EXTRA: Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Owner and manager can do all on venta_extra" ON public.venta_extra;
DROP POLICY IF EXISTS "Barber can view own venta_extra" ON public.venta_extra;

CREATE POLICY "Owner and manager can do all on venta_extra"
ON public.venta_extra FOR ALL
USING (
  venta_id IN (
    SELECT id FROM venta 
    WHERE organization_id = get_user_organization_id(auth.uid())
  )
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  venta_id IN (
    SELECT id FROM venta 
    WHERE organization_id = get_user_organization_id(auth.uid())
  )
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Barber can view own venta_extra"
ON public.venta_extra FOR SELECT
USING (
  has_role(auth.uid(), 'barber') 
  AND venta_id IN (
    SELECT id FROM venta 
    WHERE organization_id = get_user_organization_id(auth.uid())
    AND barbero_id = get_user_barbero_id(auth.uid())
  )
);

-- INGRESOS: Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Owner and manager can view all ingresos" ON public.ingresos;
DROP POLICY IF EXISTS "Barber can view own ingresos" ON public.ingresos;
DROP POLICY IF EXISTS "Owner and manager can insert ingresos" ON public.ingresos;
DROP POLICY IF EXISTS "Barber can insert own ingresos" ON public.ingresos;
DROP POLICY IF EXISTS "Owner and manager can update ingresos" ON public.ingresos;

CREATE POLICY "Owner and manager can view own org ingresos"
ON public.ingresos FOR SELECT
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Barber can view own org ingresos"
ON public.ingresos FOR SELECT
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber') 
  AND barbero = get_user_barbero_name(auth.uid())
);

CREATE POLICY "Owner and manager can insert own org ingresos"
ON public.ingresos FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Barber can insert own org ingresos"
ON public.ingresos FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber') 
  AND barbero = get_user_barbero_name(auth.uid())
);

CREATE POLICY "Owner and manager can update own org ingresos"
ON public.ingresos FOR UPDATE
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- EGRESOS: Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Owner and manager can do all on Egresos" ON public."Egresos";

CREATE POLICY "Owner and manager can do all on own org Egresos"
ON public."Egresos" FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- REPORTESMENSUALES: Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Owner and manager can do all on ReportesMensuales" ON public."ReportesMensuales";

CREATE POLICY "Owner and manager can do all on own org ReportesMensuales"
ON public."ReportesMensuales" FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- PROFILES: Agregar política para que owner vea perfiles de su org
CREATE POLICY "Owner can view org profiles"
ON public.profiles FOR SELECT
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

-- Trigger para actualizar updated_at en organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();