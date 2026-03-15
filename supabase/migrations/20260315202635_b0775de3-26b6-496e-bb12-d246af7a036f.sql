
-- Drop the existing manager SELECT policy on barberos
DROP POLICY IF EXISTS "Manager and GM can view org barberos" ON public.barberos;

-- Re-create: GM keeps full org access, manager restricted to their sucursales
CREATE POLICY "GM can view org barberos"
  ON public.barberos FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'general_manager'::app_role)
  );

CREATE POLICY "Manager can view sucursal barberos"
  ON public.barberos FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'manager'::app_role)
    AND sucursal_id IN (SELECT get_user_sucursal_ids(auth.uid()))
  );
