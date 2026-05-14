
-- descuentos_sucursales
DROP POLICY IF EXISTS manager_barber_select_descuentos_sucursales ON public.descuentos_sucursales;
DROP POLICY IF EXISTS owner_gm_all_descuentos_sucursales ON public.descuentos_sucursales;
DROP POLICY IF EXISTS owner_gm_select_descuentos_sucursales ON public.descuentos_sucursales;

CREATE POLICY manager_barber_select_descuentos_sucursales
ON public.descuentos_sucursales FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'barber'::app_role))
  AND sucursal_id IN (SELECT get_user_sucursal_ids(auth.uid()))
);

CREATE POLICY owner_gm_all_descuentos_sucursales
ON public.descuentos_sucursales FOR ALL TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
);

CREATE POLICY owner_gm_select_descuentos_sucursales
ON public.descuentos_sucursales FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
);

-- extras_sucursales
DROP POLICY IF EXISTS manager_barber_select_extras_sucursales ON public.extras_sucursales;
DROP POLICY IF EXISTS owner_gm_all_extras_sucursales ON public.extras_sucursales;
DROP POLICY IF EXISTS owner_gm_select_extras_sucursales ON public.extras_sucursales;

CREATE POLICY manager_barber_select_extras_sucursales
ON public.extras_sucursales FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'barber'::app_role))
  AND sucursal_id IN (SELECT get_user_sucursal_ids(auth.uid()))
);

CREATE POLICY owner_gm_all_extras_sucursales
ON public.extras_sucursales FOR ALL TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
);

CREATE POLICY owner_gm_select_extras_sucursales
ON public.extras_sucursales FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
);

-- servicios_sucursales
DROP POLICY IF EXISTS manager_barber_select_servicios_sucursales ON public.servicios_sucursales;
DROP POLICY IF EXISTS owner_gm_all_servicios_sucursales ON public.servicios_sucursales;
DROP POLICY IF EXISTS owner_gm_select_servicios_sucursales ON public.servicios_sucursales;

CREATE POLICY manager_barber_select_servicios_sucursales
ON public.servicios_sucursales FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'barber'::app_role))
  AND sucursal_id IN (SELECT get_user_sucursal_ids(auth.uid()))
);

CREATE POLICY owner_gm_all_servicios_sucursales
ON public.servicios_sucursales FOR ALL TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
);

CREATE POLICY owner_gm_select_servicios_sucursales
ON public.servicios_sucursales FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
);
