
ALTER TABLE public.venta
  ADD COLUMN IF NOT EXISTS cliente_id uuid NULL
  REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_venta_cliente_id ON public.venta(cliente_id);

CREATE OR REPLACE FUNCTION public.venta_validate_cliente_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_org uuid;
BEGIN
  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO v_cliente_org
  FROM public.clientes
  WHERE id = NEW.cliente_id;

  IF v_cliente_org IS NULL THEN
    RAISE EXCEPTION 'Cliente % no existe', NEW.cliente_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_cliente_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'El cliente pertenece a otra organización (cross-tenant no permitido)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venta_validate_cliente_org ON public.venta;
CREATE TRIGGER trg_venta_validate_cliente_org
BEFORE INSERT OR UPDATE OF cliente_id, organization_id ON public.venta
FOR EACH ROW
EXECUTE FUNCTION public.venta_validate_cliente_org();
