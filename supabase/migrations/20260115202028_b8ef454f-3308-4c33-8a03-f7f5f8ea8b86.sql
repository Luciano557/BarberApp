-- =====================================================
-- SECURITY HARDENING: RLS Policy Fixes
-- =====================================================

-- 1. FIX CRITICAL: ingresos table - Change barbero name comparison to barbero_id
-- Drop existing insecure policies
DROP POLICY IF EXISTS "Barber can insert own org ingresos" ON public.ingresos;
DROP POLICY IF EXISTS "Barber can view own org ingresos" ON public.ingresos;

-- Create secure policies using barbero_id instead of barbero name
CREATE POLICY "Barber can view own ingresos"
ON public.ingresos
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber')
  AND barbero_id = get_user_barbero_id(auth.uid())
);

CREATE POLICY "Barber can insert own ingresos"
ON public.ingresos
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber')
  AND barbero_id = get_user_barbero_id(auth.uid())
);

-- Update owner/manager policies to use authenticated role
DROP POLICY IF EXISTS "Owner and manager can view own org ingresos" ON public.ingresos;
DROP POLICY IF EXISTS "Owner and manager can insert own org ingresos" ON public.ingresos;
DROP POLICY IF EXISTS "Owner and manager can update own org ingresos" ON public.ingresos;

CREATE POLICY "Owner and manager can view org ingresos"
ON public.ingresos
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Owner and manager can insert org ingresos"
ON public.ingresos
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Owner and manager can update org ingresos"
ON public.ingresos
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- 2. Add DELETE policy for ingresos (owner only for audit trail)
CREATE POLICY "Owner can delete org ingresos"
ON public.ingresos
FOR DELETE
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

-- 3. Update all other policies to use TO authenticated instead of implicit public

-- barberos table
DROP POLICY IF EXISTS "Barber can view own record" ON public.barberos;
DROP POLICY IF EXISTS "Manager can view org barberos" ON public.barberos;
DROP POLICY IF EXISTS "Owner can modify own org barberos" ON public.barberos;

CREATE POLICY "Barber can view own record"
ON public.barberos
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber')
  AND id = get_user_barbero_id(auth.uid())
);

CREATE POLICY "Manager can view org barberos"
ON public.barberos
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'manager')
);

CREATE POLICY "Owner full access org barberos"
ON public.barberos
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

-- venta table
DROP POLICY IF EXISTS "Barber can view own org venta" ON public.venta;
DROP POLICY IF EXISTS "Owner and manager can do all on own org venta" ON public.venta;

CREATE POLICY "Barber can view own venta"
ON public.venta
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber')
  AND barbero_id = get_user_barbero_id(auth.uid())
);

CREATE POLICY "Owner and manager full access org venta"
ON public.venta
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- venta_extra table
DROP POLICY IF EXISTS "Barber can view own venta_extra" ON public.venta_extra;
DROP POLICY IF EXISTS "Owner and manager can do all on venta_extra" ON public.venta_extra;

CREATE POLICY "Barber can view own venta_extra"
ON public.venta_extra
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'barber')
  AND venta_id IN (
    SELECT id FROM venta 
    WHERE organization_id = get_user_organization_id(auth.uid())
    AND barbero_id = get_user_barbero_id(auth.uid())
  )
);

CREATE POLICY "Owner and manager full access venta_extra"
ON public.venta_extra
FOR ALL
TO authenticated
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

-- pagos_sueldos table
DROP POLICY IF EXISTS "Barber can view own pagos_sueldos" ON public.pagos_sueldos;
DROP POLICY IF EXISTS "Owner and manager can do all on own org pagos_sueldos" ON public.pagos_sueldos;

CREATE POLICY "Barber can view own pagos_sueldos"
ON public.pagos_sueldos
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber')
  AND barbero_id = get_user_barbero_id(auth.uid())
);

CREATE POLICY "Owner and manager full access pagos_sueldos"
ON public.pagos_sueldos
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- descuentos table
DROP POLICY IF EXISTS "Owner and manager can modify own org descuentos" ON public.descuentos;
DROP POLICY IF EXISTS "Users can view own org descuentos" ON public.descuentos;

CREATE POLICY "Users can view org descuentos"
ON public.descuentos
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owner and manager full access descuentos"
ON public.descuentos
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- extras table
DROP POLICY IF EXISTS "Owner and manager can modify own org extras" ON public.extras;
DROP POLICY IF EXISTS "Users can view own org extras" ON public.extras;

CREATE POLICY "Users can view org extras"
ON public.extras
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owner and manager full access extras"
ON public.extras
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- servicios table
DROP POLICY IF EXISTS "Owner and manager can modify own org servicios" ON public.servicios;
DROP POLICY IF EXISTS "Users can view own org servicios" ON public.servicios;

CREATE POLICY "Users can view org servicios"
ON public.servicios
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owner and manager full access servicios"
ON public.servicios
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- lineas table
DROP POLICY IF EXISTS "Owner and manager can modify own org lineas" ON public.lineas;
DROP POLICY IF EXISTS "Users can view own org lineas" ON public.lineas;

CREATE POLICY "Users can view org lineas"
ON public.lineas
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owner and manager full access lineas"
ON public.lineas
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- organizations table
DROP POLICY IF EXISTS "Owner can update own organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;

CREATE POLICY "Users can view own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owner can update own organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
)
WITH CHECK (
  id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

-- profiles table
DROP POLICY IF EXISTS "Owner can update org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owner can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Owner can view org profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

CREATE POLICY "Owner can update org profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

-- user_roles table
DROP POLICY IF EXISTS "Owner can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owner can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owner can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owner can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Owner can view org user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner')
  AND user_id IN (
    SELECT id FROM profiles 
    WHERE organization_id = get_user_organization_id(auth.uid())
  )
);

CREATE POLICY "Owner can insert org user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner')
  AND user_id IN (
    SELECT id FROM profiles 
    WHERE organization_id = get_user_organization_id(auth.uid())
  )
);

CREATE POLICY "Owner can update org user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'owner')
  AND user_id IN (
    SELECT id FROM profiles 
    WHERE organization_id = get_user_organization_id(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'owner')
  AND user_id IN (
    SELECT id FROM profiles 
    WHERE organization_id = get_user_organization_id(auth.uid())
  )
);

CREATE POLICY "Owner can delete org user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'owner')
  AND user_id IN (
    SELECT id FROM profiles 
    WHERE organization_id = get_user_organization_id(auth.uid())
  )
);

-- user_pins table
DROP POLICY IF EXISTS "Users can delete own pin" ON public.user_pins;
DROP POLICY IF EXISTS "Users can insert own pin" ON public.user_pins;
DROP POLICY IF EXISTS "Users can update own pin" ON public.user_pins;
DROP POLICY IF EXISTS "Users can view own pin" ON public.user_pins;

CREATE POLICY "Users can view own pin"
ON public.user_pins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pin"
ON public.user_pins
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pin"
ON public.user_pins
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own pin"
ON public.user_pins
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- access_logs table
DROP POLICY IF EXISTS "Authenticated users can insert own logs" ON public.access_logs;
DROP POLICY IF EXISTS "Owner can view org access logs" ON public.access_logs;

CREATE POLICY "Authenticated users can insert own logs"
ON public.access_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can view org access logs"
ON public.access_logs
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

-- anulaciones_cierre table
DROP POLICY IF EXISTS "Users can insert anulaciones for their organization" ON public.anulaciones_cierre;
DROP POLICY IF EXISTS "Users can view anulaciones from their organization" ON public.anulaciones_cierre;

CREATE POLICY "Owner and manager can insert anulaciones"
ON public.anulaciones_cierre
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Owner and manager can view anulaciones"
ON public.anulaciones_cierre
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- Egresos table
DROP POLICY IF EXISTS "Owner and manager can do all on own org Egresos" ON public."Egresos";

CREATE POLICY "Owner and manager full access Egresos"
ON public."Egresos"
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- ReportesMensuales table
DROP POLICY IF EXISTS "Owner and manager can do all on own org ReportesMensuales" ON public."ReportesMensuales";

CREATE POLICY "Owner and manager full access ReportesMensuales"
ON public."ReportesMensuales"
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- plan_features table (public read is OK for this config table)
DROP POLICY IF EXISTS "Anyone can view plan features" ON public.plan_features;

CREATE POLICY "Authenticated users can view plan features"
ON public.plan_features
FOR SELECT
TO authenticated
USING (true);