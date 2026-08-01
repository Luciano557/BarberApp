CREATE TABLE public.resumenes_mensuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  mes date NOT NULL,
  facturacion_actual numeric NOT NULL,
  facturacion_mes_anterior numeric,
  facturacion_hace_2_meses numeric,
  servicios_actual integer NOT NULL,
  servicios_mes_anterior integer,
  servicios_hace_2_meses integer,
  rentabilidad_pct numeric,
  rentabilidad_mes_anterior_pct numeric,
  rentabilidad_hace_2_meses_pct numeric,
  metodos_cobro jsonb NOT NULL DEFAULT '{}'::jsonb,
  generado_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resumenes_mensuales_unique_mes UNIQUE (organization_id, sucursal_id, mes)
);

GRANT SELECT ON public.resumenes_mensuales TO authenticated;
GRANT ALL ON public.resumenes_mensuales TO service_role;

ALTER TABLE public.resumenes_mensuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and GMs can view resumenes of their sucursales"
ON public.resumenes_mensuales
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager'))
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

CREATE INDEX idx_resumenes_mensuales_org_suc_mes ON public.resumenes_mensuales (organization_id, sucursal_id, mes DESC);

CREATE TABLE public.resumenes_mensuales_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resumen_id uuid NOT NULL REFERENCES public.resumenes_mensuales(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  read_at timestamptz,
  postponed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resumenes_mensuales_estado_unique UNIQUE (resumen_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.resumenes_mensuales_estado TO authenticated;
GRANT ALL ON public.resumenes_mensuales_estado TO service_role;

ALTER TABLE public.resumenes_mensuales_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own resumen estado"
ON public.resumenes_mensuales_estado
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "Users can insert their own resumen estado"
ON public.resumenes_mensuales_estado
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "Users can update their own resumen estado"
ON public.resumenes_mensuales_estado
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND organization_id = public.get_user_organization_id(auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE INDEX idx_resumenes_mensuales_estado_user ON public.resumenes_mensuales_estado (user_id, resumen_id);