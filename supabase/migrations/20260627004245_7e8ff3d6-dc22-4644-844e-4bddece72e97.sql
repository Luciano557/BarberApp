
CREATE TABLE public.pagos_deudas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sucursal_id     uuid,
  deuda_id        uuid NOT NULL REFERENCES public.deudas(id) ON DELETE RESTRICT,
  monto           numeric NOT NULL,
  fecha_pago      date NOT NULL,
  numero_cuota    integer,
  observacion     text,
  egreso_id       uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pagos_deudas_deuda ON public.pagos_deudas(deuda_id);
CREATE INDEX idx_pagos_deudas_org ON public.pagos_deudas(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos_deudas TO authenticated;
GRANT ALL ON public.pagos_deudas TO service_role;

ALTER TABLE public.pagos_deudas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manager and GM full access pagos_deudas"
ON public.pagos_deudas
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
