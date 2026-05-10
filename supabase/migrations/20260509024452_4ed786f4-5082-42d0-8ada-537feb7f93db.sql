
-- Add soft-delete columns to catálogo tables
ALTER TABLE public.servicios
  ADD COLUMN IF NOT EXISTS eliminado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eliminado_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS eliminado_por uuid NULL;

ALTER TABLE public.extras
  ADD COLUMN IF NOT EXISTS eliminado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eliminado_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS eliminado_por uuid NULL;

ALTER TABLE public.descuentos
  ADD COLUMN IF NOT EXISTS eliminado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eliminado_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS eliminado_por uuid NULL;

ALTER TABLE public.lineas
  ADD COLUMN IF NOT EXISTS eliminado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eliminado_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS eliminado_por uuid NULL;

-- Partial indexes for active (non-deleted) records
CREATE INDEX IF NOT EXISTS servicios_org_not_deleted_idx
  ON public.servicios (organization_id) WHERE eliminado = false;
CREATE INDEX IF NOT EXISTS extras_org_not_deleted_idx
  ON public.extras (organization_id) WHERE eliminado = false;
CREATE INDEX IF NOT EXISTS descuentos_org_not_deleted_idx
  ON public.descuentos (organization_id) WHERE eliminado = false;
CREATE INDEX IF NOT EXISTS lineas_org_not_deleted_idx
  ON public.lineas (organization_id) WHERE eliminado = false;

-- Validation: nombre no vacio y <= 80 chars
CREATE OR REPLACE FUNCTION public.validate_catalog_nombre()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nombre IS NULL OR length(btrim(NEW.nombre)) = 0 THEN
    RAISE EXCEPTION 'El nombre no puede estar vacío';
  END IF;
  IF length(btrim(NEW.nombre)) > 80 THEN
    RAISE EXCEPTION 'El nombre no puede superar los 80 caracteres';
  END IF;
  NEW.nombre := btrim(NEW.nombre);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_nombre_servicios ON public.servicios;
CREATE TRIGGER validate_nombre_servicios
  BEFORE INSERT OR UPDATE OF nombre ON public.servicios
  FOR EACH ROW EXECUTE FUNCTION public.validate_catalog_nombre();

DROP TRIGGER IF EXISTS validate_nombre_extras ON public.extras;
CREATE TRIGGER validate_nombre_extras
  BEFORE INSERT OR UPDATE OF nombre ON public.extras
  FOR EACH ROW EXECUTE FUNCTION public.validate_catalog_nombre();

DROP TRIGGER IF EXISTS validate_nombre_descuentos ON public.descuentos;
CREATE TRIGGER validate_nombre_descuentos
  BEFORE INSERT OR UPDATE OF nombre ON public.descuentos
  FOR EACH ROW EXECUTE FUNCTION public.validate_catalog_nombre();

DROP TRIGGER IF EXISTS validate_nombre_lineas ON public.lineas;
CREATE TRIGGER validate_nombre_lineas
  BEFORE INSERT OR UPDATE OF nombre ON public.lineas
  FOR EACH ROW EXECUTE FUNCTION public.validate_catalog_nombre();

-- Validation: descuento porcentual entre 0 (excl) y 100 (incl)
CREATE OR REPLACE FUNCTION public.validate_descuento_valor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'porcentaje' THEN
    IF NEW.valor IS NULL OR NEW.valor <= 0 OR NEW.valor > 100 THEN
      RAISE EXCEPTION 'El porcentaje debe ser mayor a 0 y menor o igual a 100';
    END IF;
  ELSE
    IF NEW.valor IS NULL OR NEW.valor < 0 THEN
      RAISE EXCEPTION 'El monto debe ser igual o mayor a 0';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_valor_descuentos ON public.descuentos;
CREATE TRIGGER validate_valor_descuentos
  BEFORE INSERT OR UPDATE OF valor, tipo ON public.descuentos
  FOR EACH ROW EXECUTE FUNCTION public.validate_descuento_valor();
