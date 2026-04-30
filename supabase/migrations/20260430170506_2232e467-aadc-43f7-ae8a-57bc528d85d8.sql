
-- =====================================================================
-- FASE 1: Normalización del catálogo (catálogo global + config por sucursal)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CREATE servicios_sucursales
-- ---------------------------------------------------------------------
CREATE TABLE public.servicios_sucursales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  servicio_id     uuid NOT NULL REFERENCES public.servicios(id)  ON DELETE CASCADE,
  sucursal_id     uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  activo          boolean NOT NULL DEFAULT true,
  precio          numeric NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT servicios_sucursales_unique UNIQUE (organization_id, servicio_id, sucursal_id)
);

CREATE INDEX idx_servicios_sucursales_org      ON public.servicios_sucursales (organization_id);
CREATE INDEX idx_servicios_sucursales_suc_act  ON public.servicios_sucursales (sucursal_id, activo);
CREATE INDEX idx_servicios_sucursales_servicio ON public.servicios_sucursales (servicio_id);

CREATE TRIGGER set_updated_at_servicios_sucursales
  BEFORE UPDATE ON public.servicios_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.servicios_sucursales IS
  'Configuracion por sucursal de cada servicio: activo y precio. El servicio en si vive en la tabla servicios (catalogo global por organizacion).';

-- ---------------------------------------------------------------------
-- 2. CREATE extras_sucursales
-- ---------------------------------------------------------------------
CREATE TABLE public.extras_sucursales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  extra_id        uuid NOT NULL REFERENCES public.extras(id)     ON DELETE CASCADE,
  sucursal_id     uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  activo          boolean NOT NULL DEFAULT true,
  precio          numeric NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extras_sucursales_unique UNIQUE (organization_id, extra_id, sucursal_id)
);

CREATE INDEX idx_extras_sucursales_org     ON public.extras_sucursales (organization_id);
CREATE INDEX idx_extras_sucursales_suc_act ON public.extras_sucursales (sucursal_id, activo);
CREATE INDEX idx_extras_sucursales_extra   ON public.extras_sucursales (extra_id);

CREATE TRIGGER set_updated_at_extras_sucursales
  BEFORE UPDATE ON public.extras_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.extras_sucursales IS
  'Configuracion por sucursal de cada extra: activo y precio. El extra en si vive en la tabla extras (catalogo global por organizacion).';

-- ---------------------------------------------------------------------
-- 3. descuentos_sucursales: asegurar UNIQUE/indices/trigger
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'descuentos_sucursales_unique'
  ) THEN
    ALTER TABLE public.descuentos_sucursales
      ADD CONSTRAINT descuentos_sucursales_unique
      UNIQUE (organization_id, descuento_id, sucursal_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_descuentos_sucursales_org       ON public.descuentos_sucursales (organization_id);
CREATE INDEX IF NOT EXISTS idx_descuentos_sucursales_suc_act   ON public.descuentos_sucursales (sucursal_id, activo);
CREATE INDEX IF NOT EXISTS idx_descuentos_sucursales_descuento ON public.descuentos_sucursales (descuento_id);

DROP TRIGGER IF EXISTS set_updated_at_descuentos_sucursales ON public.descuentos_sucursales;
CREATE TRIGGER set_updated_at_descuentos_sucursales
  BEFORE UPDATE ON public.descuentos_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.descuentos_sucursales IS
  'Configuracion por sucursal de cada descuento: activo. El descuento en si vive en la tabla descuentos (catalogo global por organizacion).';

-- ---------------------------------------------------------------------
-- 4. Limpiar descuentos_sucursales para reconstruir
-- ---------------------------------------------------------------------
DELETE FROM public.descuentos_sucursales;

-- ---------------------------------------------------------------------
-- 5. Backfill servicios_sucursales (orden A -> C -> B)
-- ---------------------------------------------------------------------
-- A) sucursal de origen del servicio: respeta activo y precio reales
INSERT INTO public.servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
SELECT s.organization_id, s.id, s.sucursal_id, s.activo, COALESCE(s.precio, 0)
FROM public.servicios s
WHERE s.sucursal_id IS NOT NULL
ON CONFLICT (organization_id, servicio_id, sucursal_id) DO NOTHING;

-- C) servicios con sucursal_id NULL: aplicar valores legacy a TODAS las sucursales
INSERT INTO public.servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
SELECT s.organization_id, s.id, su.id, s.activo, COALESCE(s.precio, 0)
FROM public.servicios s
JOIN public.sucursales su ON su.organization_id = s.organization_id
WHERE s.sucursal_id IS NULL
ON CONFLICT (organization_id, servicio_id, sucursal_id) DO NOTHING;

-- B) Relleno final: completar combinaciones faltantes con activo=true, precio=0
INSERT INTO public.servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
SELECT s.organization_id, s.id, su.id, true, 0
FROM public.servicios s
JOIN public.sucursales su ON su.organization_id = s.organization_id
ON CONFLICT (organization_id, servicio_id, sucursal_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. Backfill extras_sucursales (orden A -> C -> B)
-- ---------------------------------------------------------------------
INSERT INTO public.extras_sucursales (organization_id, extra_id, sucursal_id, activo, precio)
SELECT e.organization_id, e.id, e.sucursal_id, e.activo, COALESCE(e.precio, 0)
FROM public.extras e
WHERE e.sucursal_id IS NOT NULL
ON CONFLICT (organization_id, extra_id, sucursal_id) DO NOTHING;

INSERT INTO public.extras_sucursales (organization_id, extra_id, sucursal_id, activo, precio)
SELECT e.organization_id, e.id, su.id, e.activo, COALESCE(e.precio, 0)
FROM public.extras e
JOIN public.sucursales su ON su.organization_id = e.organization_id
WHERE e.sucursal_id IS NULL
ON CONFLICT (organization_id, extra_id, sucursal_id) DO NOTHING;

INSERT INTO public.extras_sucursales (organization_id, extra_id, sucursal_id, activo, precio)
SELECT e.organization_id, e.id, su.id, true, 0
FROM public.extras e
JOIN public.sucursales su ON su.organization_id = e.organization_id
ON CONFLICT (organization_id, extra_id, sucursal_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 7. Backfill descuentos_sucursales (reconstruccion limpia)
-- ---------------------------------------------------------------------
INSERT INTO public.descuentos_sucursales (organization_id, descuento_id, sucursal_id, activo)
SELECT d.organization_id, d.id, su.id, d.activo
FROM public.descuentos d
JOIN public.sucursales su ON su.organization_id = d.organization_id
ON CONFLICT (organization_id, descuento_id, sucursal_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 8. Backfill productos_sucursal faltantes (sin tocar filas existentes)
-- ---------------------------------------------------------------------
INSERT INTO public.productos_sucursal
  (organization_id, producto_id, sucursal_id, activo,
   precio_venta, precio_costo, stock_actual, stock_minimo)
SELECT
  p.organization_id, p.id, su.id, true,
  COALESCE(
    (SELECT ps.precio_venta FROM public.productos_sucursal ps
     WHERE ps.producto_id = p.id
     ORDER BY ps.created_at ASC NULLS LAST LIMIT 1),
    0
  ),
  NULL, 0, 0
FROM public.productos p
JOIN public.sucursales su ON su.organization_id = p.organization_id
ON CONFLICT (producto_id, sucursal_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 9. Triggers de auto-clonado
-- ---------------------------------------------------------------------

-- 9.1 Servicio nuevo
CREATE OR REPLACE FUNCTION public.clone_servicio_to_sucursales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sucursal_id IS NOT NULL THEN
    INSERT INTO public.servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
    VALUES (NEW.organization_id, NEW.id, NEW.sucursal_id, NEW.activo, COALESCE(NEW.precio, 0))
    ON CONFLICT DO NOTHING;

    INSERT INTO public.servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
    SELECT NEW.organization_id, NEW.id, su.id, true, 0
    FROM public.sucursales su
    WHERE su.organization_id = NEW.organization_id
      AND su.id <> NEW.sucursal_id
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
    SELECT NEW.organization_id, NEW.id, su.id, NEW.activo, COALESCE(NEW.precio, 0)
    FROM public.sucursales su
    WHERE su.organization_id = NEW.organization_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clone_servicio
  AFTER INSERT ON public.servicios
  FOR EACH ROW EXECUTE FUNCTION public.clone_servicio_to_sucursales();

-- 9.2 Extra nuevo
CREATE OR REPLACE FUNCTION public.clone_extra_to_sucursales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sucursal_id IS NOT NULL THEN
    INSERT INTO public.extras_sucursales (organization_id, extra_id, sucursal_id, activo, precio)
    VALUES (NEW.organization_id, NEW.id, NEW.sucursal_id, NEW.activo, COALESCE(NEW.precio, 0))
    ON CONFLICT DO NOTHING;

    INSERT INTO public.extras_sucursales (organization_id, extra_id, sucursal_id, activo, precio)
    SELECT NEW.organization_id, NEW.id, su.id, true, 0
    FROM public.sucursales su
    WHERE su.organization_id = NEW.organization_id
      AND su.id <> NEW.sucursal_id
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.extras_sucursales (organization_id, extra_id, sucursal_id, activo, precio)
    SELECT NEW.organization_id, NEW.id, su.id, NEW.activo, COALESCE(NEW.precio, 0)
    FROM public.sucursales su
    WHERE su.organization_id = NEW.organization_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clone_extra
  AFTER INSERT ON public.extras
  FOR EACH ROW EXECUTE FUNCTION public.clone_extra_to_sucursales();

-- 9.3 Descuento nuevo
CREATE OR REPLACE FUNCTION public.clone_descuento_to_sucursales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.descuentos_sucursales (organization_id, descuento_id, sucursal_id, activo)
  SELECT NEW.organization_id, NEW.id, su.id, NEW.activo
  FROM public.sucursales su
  WHERE su.organization_id = NEW.organization_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clone_descuento
  AFTER INSERT ON public.descuentos
  FOR EACH ROW EXECUTE FUNCTION public.clone_descuento_to_sucursales();

-- 9.4 Producto / productos_sucursal: trigger sobre productos_sucursal con guardia anti-recursion
CREATE OR REPLACE FUNCTION public.clone_producto_sucursal_to_others()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anti-recursion: si este INSERT fue disparado por el propio trigger
  -- o por clone_catalog_to_new_sucursal, no propagar de nuevo.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.productos_sucursal (
    organization_id, producto_id, sucursal_id, activo,
    precio_venta, precio_costo, stock_actual, stock_minimo
  )
  SELECT
    NEW.organization_id, NEW.producto_id, su.id, true,
    NEW.precio_venta, NEW.precio_costo, 0, 0
  FROM public.sucursales su
  WHERE su.organization_id = NEW.organization_id
    AND su.id <> NEW.sucursal_id
  ON CONFLICT (producto_id, sucursal_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clone_producto_sucursal
  AFTER INSERT ON public.productos_sucursal
  FOR EACH ROW EXECUTE FUNCTION public.clone_producto_sucursal_to_others();

-- 9.5 Sucursal nueva: clonar todo el catalogo de la organizacion
CREATE OR REPLACE FUNCTION public.clone_catalog_to_new_sucursal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Servicios
  INSERT INTO public.servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
  SELECT NEW.organization_id, s.id, NEW.id, true, 0
  FROM public.servicios s
  WHERE s.organization_id = NEW.organization_id
  ON CONFLICT DO NOTHING;

  -- Extras
  INSERT INTO public.extras_sucursales (organization_id, extra_id, sucursal_id, activo, precio)
  SELECT NEW.organization_id, e.id, NEW.id, true, 0
  FROM public.extras e
  WHERE e.organization_id = NEW.organization_id
  ON CONFLICT DO NOTHING;

  -- Descuentos
  INSERT INTO public.descuentos_sucursales (organization_id, descuento_id, sucursal_id, activo)
  SELECT NEW.organization_id, d.id, NEW.id, d.activo
  FROM public.descuentos d
  WHERE d.organization_id = NEW.organization_id
  ON CONFLICT DO NOTHING;

  -- Productos: heredar precio de la sucursal de referencia mas antigua si existe
  INSERT INTO public.productos_sucursal (
    organization_id, producto_id, sucursal_id, activo,
    precio_venta, precio_costo, stock_actual, stock_minimo
  )
  SELECT
    NEW.organization_id, p.id, NEW.id, true,
    COALESCE(
      (SELECT ps.precio_venta FROM public.productos_sucursal ps
       WHERE ps.producto_id = p.id
       ORDER BY ps.created_at ASC NULLS LAST LIMIT 1),
      0
    ),
    NULL, 0, 0
  FROM public.productos p
  WHERE p.organization_id = NEW.organization_id
  ON CONFLICT (producto_id, sucursal_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clone_catalog_new_sucursal
  AFTER INSERT ON public.sucursales
  FOR EACH ROW EXECUTE FUNCTION public.clone_catalog_to_new_sucursal();

-- ---------------------------------------------------------------------
-- 10. RLS — Fase 1 conservadora
-- ---------------------------------------------------------------------

-- 10.1 servicios_sucursales
ALTER TABLE public.servicios_sucursales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_gm_select_servicios_sucursales"
  ON public.servicios_sucursales FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  );

CREATE POLICY "owner_gm_all_servicios_sucursales"
  ON public.servicios_sucursales FOR ALL
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  );

CREATE POLICY "manager_barber_select_servicios_sucursales"
  ON public.servicios_sucursales FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'barber'))
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- 10.2 extras_sucursales
ALTER TABLE public.extras_sucursales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_gm_select_extras_sucursales"
  ON public.extras_sucursales FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  );

CREATE POLICY "owner_gm_all_extras_sucursales"
  ON public.extras_sucursales FOR ALL
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  );

CREATE POLICY "manager_barber_select_extras_sucursales"
  ON public.extras_sucursales FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'barber'))
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- 10.3 descuentos_sucursales: DROP politicas previas + CREATE las tres nuevas
DROP POLICY IF EXISTS "Owner manager and GM full access descuentos_sucursales" ON public.descuentos_sucursales;
DROP POLICY IF EXISTS "Users can view org descuentos_sucursales"                 ON public.descuentos_sucursales;

CREATE POLICY "owner_gm_select_descuentos_sucursales"
  ON public.descuentos_sucursales FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  );

CREATE POLICY "owner_gm_all_descuentos_sucursales"
  ON public.descuentos_sucursales FOR ALL
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  );

CREATE POLICY "manager_barber_select_descuentos_sucursales"
  ON public.descuentos_sucursales FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'barber'))
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );
