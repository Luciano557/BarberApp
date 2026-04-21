-- =========================================================
-- 1.1  payment_methods_config
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payment_methods_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id     uuid NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  metodo_pago     text NOT NULL,
  activo          boolean NOT NULL DEFAULT true,
  recargo_pct     numeric(5,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pmc_metodo_pago_valido
    CHECK (metodo_pago IN ('efectivo','mercado_pago','transferencia','debito','credito')),
  CONSTRAINT pmc_recargo_pct_rango
    CHECK (recargo_pct >= 0 AND recargo_pct <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_config_general_uidx
  ON public.payment_methods_config (organization_id, metodo_pago)
  WHERE sucursal_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_config_sucursal_uidx
  ON public.payment_methods_config (organization_id, sucursal_id, metodo_pago)
  WHERE sucursal_id IS NOT NULL;

ALTER TABLE public.payment_methods_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access payment_methods_config"
  ON public.payment_methods_config
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

CREATE POLICY "Users can view org payment_methods_config"
  ON public.payment_methods_config
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE TRIGGER update_payment_methods_config_updated_at
  BEFORE UPDATE ON public.payment_methods_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 1.2  sucursal_payment_settings
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sucursal_payment_settings (
  sucursal_id          uuid PRIMARY KEY REFERENCES public.sucursales(id) ON DELETE CASCADE,
  organization_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  usar_config_general  boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sucursal_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access sucursal_payment_settings"
  ON public.sucursal_payment_settings
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

CREATE POLICY "Users can view org sucursal_payment_settings"
  ON public.sucursal_payment_settings
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE TRIGGER update_sucursal_payment_settings_updated_at
  BEFORE UPDATE ON public.sucursal_payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 1.3  venta : recargo_total + total_cobrado
-- =========================================================
ALTER TABLE public.venta
  ADD COLUMN IF NOT EXISTS recargo_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cobrado numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venta_recargo_total_nonneg'
  ) THEN
    ALTER TABLE public.venta
      ADD CONSTRAINT venta_recargo_total_nonneg CHECK (recargo_total >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venta_total_cobrado_nonneg'
  ) THEN
    ALTER TABLE public.venta
      ADD CONSTRAINT venta_total_cobrado_nonneg
      CHECK (total_cobrado IS NULL OR total_cobrado >= 0);
  END IF;
END $$;

-- Backfill ventas
UPDATE public.venta
   SET recargo_total = COALESCE(recargo_total, 0),
       total_cobrado = COALESCE(total_cobrado, total_final);

-- =========================================================
-- 1.4  venta_pagos : recargo_pct + recargo_monto + base_pago
-- =========================================================
ALTER TABLE public.venta_pagos
  ADD COLUMN IF NOT EXISTS recargo_pct   numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recargo_monto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_pago     numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vp_recargo_pct_rango') THEN
    ALTER TABLE public.venta_pagos
      ADD CONSTRAINT vp_recargo_pct_rango
      CHECK (recargo_pct >= 0 AND recargo_pct <= 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vp_recargo_monto_nonneg') THEN
    ALTER TABLE public.venta_pagos
      ADD CONSTRAINT vp_recargo_monto_nonneg CHECK (recargo_monto >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vp_base_pago_nonneg') THEN
    ALTER TABLE public.venta_pagos
      ADD CONSTRAINT vp_base_pago_nonneg
      CHECK (base_pago IS NULL OR base_pago >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'venta_pagos_metodo_pago_valido') THEN
    ALTER TABLE public.venta_pagos
      ADD CONSTRAINT venta_pagos_metodo_pago_valido
      CHECK (metodo_pago IN ('efectivo','mercado_pago','transferencia','debito','credito'));
  END IF;
END $$;

-- Backfill venta_pagos
UPDATE public.venta_pagos
   SET base_pago     = COALESCE(base_pago, monto),
       recargo_pct   = COALESCE(recargo_pct, 0),
       recargo_monto = COALESCE(recargo_monto, 0);

-- =========================================================
-- 1.5  ingresos : snapshot de arqueo del cierre
-- =========================================================
ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS recargos_total   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cobrado    numeric,
  ADD COLUMN IF NOT EXISTS efectivo_cobrado numeric,
  ADD COLUMN IF NOT EXISTS digital_cobrado  numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ing_recargos_total_nonneg') THEN
    ALTER TABLE public.ingresos
      ADD CONSTRAINT ing_recargos_total_nonneg CHECK (recargos_total >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ing_total_cobrado_nonneg') THEN
    ALTER TABLE public.ingresos
      ADD CONSTRAINT ing_total_cobrado_nonneg
      CHECK (total_cobrado IS NULL OR total_cobrado >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ing_efectivo_cobrado_nonneg') THEN
    ALTER TABLE public.ingresos
      ADD CONSTRAINT ing_efectivo_cobrado_nonneg
      CHECK (efectivo_cobrado IS NULL OR efectivo_cobrado >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ing_digital_cobrado_nonneg') THEN
    ALTER TABLE public.ingresos
      ADD CONSTRAINT ing_digital_cobrado_nonneg
      CHECK (digital_cobrado IS NULL OR digital_cobrado >= 0);
  END IF;
END $$;

-- Backfill cierres histórico (snapshot a partir de campos legacy)
UPDATE public.ingresos
   SET recargos_total   = COALESCE(recargos_total, 0),
       efectivo_cobrado = COALESCE(efectivo_cobrado, COALESCE(efectivo, 0)),
       digital_cobrado  = COALESCE(digital_cobrado, COALESCE(mp, 0)),
       total_cobrado    = COALESCE(total_cobrado, COALESCE(total_facturado, 0));

-- =========================================================
-- 3.  Seed config general para organizaciones existentes
-- =========================================================
INSERT INTO public.payment_methods_config (organization_id, sucursal_id, metodo_pago, activo, recargo_pct)
SELECT o.id, NULL, m, true, 0
FROM public.organizations o
CROSS JOIN unnest(ARRAY['efectivo','mercado_pago','transferencia','debito','credito']) AS m
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods_config pmc
  WHERE pmc.organization_id = o.id
    AND pmc.sucursal_id IS NULL
    AND pmc.metodo_pago = m
);

-- =========================================================
-- 4.  Función helper: seed config para una org nueva
-- =========================================================
CREATE OR REPLACE FUNCTION public.seed_payment_methods_for_org(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payment_methods_config (organization_id, sucursal_id, metodo_pago, activo, recargo_pct)
  SELECT _org_id, NULL, m, true, 0
  FROM unnest(ARRAY['efectivo','mercado_pago','transferencia','debito','credito']) AS m
  ON CONFLICT DO NOTHING;
END;
$$;

-- =========================================================
-- 5.  Trigger: al crear una organización, sembrar config
-- =========================================================
CREATE OR REPLACE FUNCTION public.on_organization_created_seed_payment_methods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_payment_methods_for_org(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_payment_methods_on_org_create ON public.organizations;
CREATE TRIGGER trg_seed_payment_methods_on_org_create
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.on_organization_created_seed_payment_methods();