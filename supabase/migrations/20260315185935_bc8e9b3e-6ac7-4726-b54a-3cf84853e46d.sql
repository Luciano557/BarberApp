
-- Table: inversiones
CREATE TABLE public.inversiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  nombre text NOT NULL,
  monto_total numeric NOT NULL,
  fecha_compra date NOT NULL,
  meses_amortizacion integer NOT NULL,
  categoria text,
  descripcion text,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inversiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and manager full access inversiones"
  ON public.inversiones FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

-- Table: deudas
CREATE TABLE public.deudas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  inversion_id uuid REFERENCES public.inversiones(id) ON DELETE SET NULL,
  acreedor text NOT NULL,
  monto_total numeric NOT NULL,
  monto_pagado numeric NOT NULL DEFAULT 0,
  cuotas_totales integer,
  cuotas_pagadas integer NOT NULL DEFAULT 0,
  monto_cuota numeric,
  fecha_inicio date NOT NULL,
  fecha_proximo_pago date,
  descripcion text,
  estado text NOT NULL DEFAULT 'activa',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deudas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and manager full access deudas"
  ON public.deudas FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );
