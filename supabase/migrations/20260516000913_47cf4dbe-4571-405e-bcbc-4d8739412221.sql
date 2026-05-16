DROP POLICY IF EXISTS "Barber can view own turnos" ON public.turnos;

CREATE POLICY "Barber can view sucursal turnos"
ON public.turnos
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'barber'::app_role)
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);