
-- 1. tareas: re-create write policies targeting authenticated only
DROP POLICY IF EXISTS "Barbers can create peticiones" ON public.tareas;
DROP POLICY IF EXISTS "Barbers can update assigned task estado" ON public.tareas;
DROP POLICY IF EXISTS "Owner GM Manager can delete tareas" ON public.tareas;
DROP POLICY IF EXISTS "Owner GM Manager can insert tareas" ON public.tareas;
DROP POLICY IF EXISTS "Owner GM Manager can update tareas" ON public.tareas;

CREATE POLICY "Barbers can create peticiones"
ON public.tareas FOR INSERT TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND tipo = 'peticion'
  AND creado_por_id = auth.uid()
  AND has_role(auth.uid(), 'barber'::app_role)
);

CREATE POLICY "Barbers can update assigned task estado"
ON public.tareas FOR UPDATE TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber'::app_role)
  AND asignado_a_id = get_user_barbero_id(auth.uid())
);

CREATE POLICY "Owner GM Manager can delete tareas"
ON public.tareas FOR DELETE TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role)
       OR has_role(auth.uid(), 'general_manager'::app_role)
       OR has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Owner GM Manager can insert tareas"
ON public.tareas FOR INSERT TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role)
       OR has_role(auth.uid(), 'general_manager'::app_role)
       OR has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Owner GM Manager can update tareas"
ON public.tareas FOR UPDATE TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role)
       OR has_role(auth.uid(), 'general_manager'::app_role)
       OR has_role(auth.uid(), 'manager'::app_role))
);

-- 2. barberos: hide pin_hash via column-level privileges
REVOKE SELECT ON public.barberos FROM authenticated, anon;
GRANT SELECT (
  id, nombre, apellido, dni, telefono, activo, created_at, updated_at,
  comision, organization_id, sucursal_id, tipo_compensacion, sueldo_fijo,
  rol_equipo, fecha_cobro_dia, access_email, roles_equipo
) ON public.barberos TO authenticated;
-- Note: pin_hash remains accessible via service_role (used by edge functions).

-- 3. anulaciones_cierre: do not expose staff emails to sucursal accounts
DROP POLICY IF EXISTS "Sucursal account view anulaciones_cierre" ON public.anulaciones_cierre;

-- 4. lock search_path on touch_user_onboarding
ALTER FUNCTION public.touch_user_onboarding() SET search_path = public;

-- 5. portal-logos public bucket: drop broad listing policy
-- Files stay reachable via their public URL (CDN), but the bucket can no longer be enumerated.
DROP POLICY IF EXISTS "portal_logos_public_read" ON storage.objects;
