-- 1) Columnas de soft delete
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS eliminado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eliminado_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS eliminado_por uuid NULL;

-- 2) Índice parcial para listados de clientes vigentes
CREATE INDEX IF NOT EXISTS clientes_no_eliminados_idx
  ON public.clientes (organization_id)
  WHERE eliminado = false;

-- 3) RPC para eliminación lógica
CREATE OR REPLACE FUNCTION public.soft_delete_cliente(_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _cli_org_id uuid;
  _can boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _org_id := public.get_user_organization_id(_user_id);
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente no valido';
  END IF;

  SELECT organization_id INTO _cli_org_id
  FROM public.clientes
  WHERE id = _cliente_id;

  IF _cli_org_id IS NULL OR _cli_org_id <> _org_id THEN
    RAISE EXCEPTION 'Cliente no valido';
  END IF;

  _can := public.has_role(_user_id, 'owner'::app_role)
       OR public.has_role(_user_id, 'general_manager'::app_role)
       OR public.has_role(_user_id, 'manager'::app_role);

  IF NOT _can THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.clientes
  SET eliminado = true,
      eliminado_at = now(),
      eliminado_por = _user_id,
      updated_at = now()
  WHERE id = _cliente_id
    AND eliminado = false;
END;
$$;