DROP POLICY IF EXISTS "Barber can view own turnos" ON public.turnos;

CREATE POLICY "Barber view sucursal turnos"
  ON public.turnos
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber'::app_role)
    AND sucursal_id IN (SELECT get_user_sucursal_ids(auth.uid()))
  );