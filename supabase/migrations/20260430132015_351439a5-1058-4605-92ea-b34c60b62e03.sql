
ALTER TABLE public.venta_descuentos_aplicados ADD COLUMN IF NOT EXISTS barbero_id uuid;

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS venta_descuentos_aplicados_venta_tipo_uniq
  ON public.venta_descuentos_aplicados (venta_id, descuento_aplica_a);
CREATE INDEX IF NOT EXISTS venta_descuentos_aplicados_org_venta_idx
  ON public.venta_descuentos_aplicados (organization_id, venta_id);
CREATE INDEX IF NOT EXISTS venta_descuentos_aplicados_sucursal_idx
  ON public.venta_descuentos_aplicados (sucursal_id);
CREATE INDEX IF NOT EXISTS venta_descuentos_aplicados_barbero_idx
  ON public.venta_descuentos_aplicados (barbero_id);
CREATE INDEX IF NOT EXISTS venta_descuentos_aplicados_descuento_idx
  ON public.venta_descuentos_aplicados (descuento_id);

-- RLS
ALTER TABLE public.venta_descuentos_aplicados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner and GM full access vda" ON public.venta_descuentos_aplicados;
CREATE POLICY "Owner and GM full access vda"
ON public.venta_descuentos_aplicados FOR ALL TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'general_manager'::app_role))
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'general_manager'::app_role))
);

DROP POLICY IF EXISTS "Manager select vda by sucursal" ON public.venta_descuentos_aplicados;
CREATE POLICY "Manager select vda by sucursal"
ON public.venta_descuentos_aplicados FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(),'manager'::app_role)
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Manager insert vda by sucursal" ON public.venta_descuentos_aplicados;
CREATE POLICY "Manager insert vda by sucursal"
ON public.venta_descuentos_aplicados FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(),'manager'::app_role)
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Barber select own vda" ON public.venta_descuentos_aplicados;
CREATE POLICY "Barber select own vda"
ON public.venta_descuentos_aplicados FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(),'barber'::app_role)
  AND barbero_id = public.get_user_barbero_id(auth.uid())
);

DROP POLICY IF EXISTS "Barber insert own vda" ON public.venta_descuentos_aplicados;
CREATE POLICY "Barber insert own vda"
ON public.venta_descuentos_aplicados FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(),'barber'::app_role)
  AND barbero_id = public.get_user_barbero_id(auth.uid())
);

-- CHECK descuentos.aplica_a
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'descuentos_aplica_a_check') THEN
    ALTER TABLE public.descuentos
      ADD CONSTRAINT descuentos_aplica_a_check
      CHECK (aplica_a IN ('servicios','productos'));
  END IF;
END$$;
