-- Hotfix: missing SELECT policies for sucursal_account on operational catalog tables.
-- All policies are scoped by organization_id (and sucursal_id where applicable),
-- and only grant SELECT. No existing policy is altered.

-- servicios_sucursales
CREATE POLICY "Sucursal account view servicios_sucursales"
ON public.servicios_sucursales
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.is_sucursal_account(auth.uid())
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

-- extras_sucursales
CREATE POLICY "Sucursal account view extras_sucursales"
ON public.extras_sucursales
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.is_sucursal_account(auth.uid())
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

-- descuentos_sucursales
CREATE POLICY "Sucursal account view descuentos_sucursales"
ON public.descuentos_sucursales
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.is_sucursal_account(auth.uid())
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

-- productos_sucursal
CREATE POLICY "Sucursal account view productos_sucursal"
ON public.productos_sucursal
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.is_sucursal_account(auth.uid())
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

-- comision_productos_config (no sucursal_id column; org-scoped only)
CREATE POLICY "Sucursal account view comision_productos_config"
ON public.comision_productos_config
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.is_sucursal_account(auth.uid())
);
