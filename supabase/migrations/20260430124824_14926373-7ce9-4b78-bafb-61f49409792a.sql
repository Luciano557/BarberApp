
-- 1. CHECK en descuentos.aplica_a
ALTER TABLE public.descuentos
  DROP CONSTRAINT IF EXISTS descuentos_aplica_a_check;
ALTER TABLE public.descuentos
  ADD CONSTRAINT descuentos_aplica_a_check
  CHECK (aplica_a IN ('servicios', 'productos'));

-- 2. Tabla descuentos_sucursales
CREATE TABLE IF NOT EXISTS public.descuentos_sucursales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  descuento_id uuid NOT NULL REFERENCES public.descuentos(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT descuentos_sucursales_unique UNIQUE (organization_id, descuento_id, sucursal_id)
);

CREATE INDEX IF NOT EXISTS idx_descuentos_sucursales_descuento ON public.descuentos_sucursales(descuento_id);
CREATE INDEX IF NOT EXISTS idx_descuentos_sucursales_sucursal ON public.descuentos_sucursales(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_descuentos_sucursales_org ON public.descuentos_sucursales(organization_id);

ALTER TABLE public.descuentos_sucursales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org descuentos_sucursales" ON public.descuentos_sucursales;
CREATE POLICY "Users can view org descuentos_sucursales"
  ON public.descuentos_sucursales
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "Owner manager and GM full access descuentos_sucursales" ON public.descuentos_sucursales;
CREATE POLICY "Owner manager and GM full access descuentos_sucursales"
  ON public.descuentos_sucursales
  FOR ALL
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'general_manager'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'general_manager'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

DROP TRIGGER IF EXISTS trg_descuentos_sucursales_updated_at ON public.descuentos_sucursales;
CREATE TRIGGER trg_descuentos_sucursales_updated_at
  BEFORE UPDATE ON public.descuentos_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Backfill: para cada descuento, una fila por cada sucursal de su organización (activo=true)
INSERT INTO public.descuentos_sucursales (organization_id, descuento_id, sucursal_id, activo)
SELECT d.organization_id, d.id, s.id, true
FROM public.descuentos d
JOIN public.sucursales s ON s.organization_id = d.organization_id
WHERE d.organization_id IS NOT NULL
ON CONFLICT (organization_id, descuento_id, sucursal_id) DO NOTHING;

-- 4. Tabla venta_descuentos_aplicados
CREATE TABLE IF NOT EXISTS public.venta_descuentos_aplicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sucursal_id uuid NULL,
  venta_id uuid NOT NULL REFERENCES public.venta(id) ON DELETE CASCADE,
  descuento_id uuid NULL REFERENCES public.descuentos(id) ON DELETE SET NULL,
  descuento_nombre text NOT NULL,
  descuento_tipo text NOT NULL,
  descuento_valor numeric NOT NULL DEFAULT 0,
  descuento_aplica_a text NOT NULL,
  subtotal_base numeric NOT NULL DEFAULT 0,
  monto_aplicado numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venta_descuentos_aplicados_aplica_a_check
    CHECK (descuento_aplica_a IN ('servicios', 'productos'))
);

CREATE INDEX IF NOT EXISTS idx_vda_venta ON public.venta_descuentos_aplicados(venta_id);
CREATE INDEX IF NOT EXISTS idx_vda_org_suc_created ON public.venta_descuentos_aplicados(organization_id, sucursal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vda_descuento ON public.venta_descuentos_aplicados(descuento_id);

ALTER TABLE public.venta_descuentos_aplicados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner GM Manager view vda" ON public.venta_descuentos_aplicados;
CREATE POLICY "Owner GM Manager view vda"
  ON public.venta_descuentos_aplicados
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'general_manager'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

DROP POLICY IF EXISTS "Barber view own vda" ON public.venta_descuentos_aplicados;
CREATE POLICY "Barber view own vda"
  ON public.venta_descuentos_aplicados
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'barber'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.venta v
      WHERE v.id = venta_descuentos_aplicados.venta_id
        AND v.barbero_id = public.get_user_barbero_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authorized roles can insert vda" ON public.venta_descuentos_aplicados;
CREATE POLICY "Authorized roles can insert vda"
  ON public.venta_descuentos_aplicados
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'general_manager'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'barber'::app_role)
    )
    AND EXISTS (
      SELECT 1 FROM public.venta v
      WHERE v.id = venta_descuentos_aplicados.venta_id
        AND v.organization_id = venta_descuentos_aplicados.organization_id
    )
  );
