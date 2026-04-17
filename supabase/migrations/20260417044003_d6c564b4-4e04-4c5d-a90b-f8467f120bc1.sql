-- Create venta_pagos table for mixed payments support
CREATE TABLE public.venta_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES public.venta(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  sucursal_id uuid,
  metodo_pago text NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  orden integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_venta_pagos_venta_id ON public.venta_pagos(venta_id);
CREATE INDEX idx_venta_pagos_org ON public.venta_pagos(organization_id);

ALTER TABLE public.venta_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM manager full access venta_pagos"
  ON public.venta_pagos
  FOR ALL
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'general_manager'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'general_manager'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "Barber can view own venta_pagos"
  ON public.venta_pagos
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber'::app_role)
    AND venta_id IN (
      SELECT id FROM public.venta WHERE barbero_id = get_user_barbero_id(auth.uid())
    )
  );

CREATE POLICY "Barber can insert own venta_pagos"
  ON public.venta_pagos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber'::app_role)
    AND venta_id IN (
      SELECT id FROM public.venta WHERE barbero_id = get_user_barbero_id(auth.uid())
    )
  );