-- ============================================================
-- 1) Tablas
-- ============================================================
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  nombre text NOT NULL,
  apellido text NOT NULL,
  telefono text NULL,
  email text NULL,
  origen text NOT NULL DEFAULT 'manual',
  nota_interna text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clientes_origen_check CHECK (origen IN ('manual','importado','reserva'))
);

CREATE INDEX idx_clientes_organization_id ON public.clientes(organization_id);

CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.clientes_sucursales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  sucursal_id uuid NOT NULL,
  origen_relacion text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clientes_sucursales_unique UNIQUE (organization_id, cliente_id, sucursal_id),
  CONSTRAINT clientes_sucursales_origen_check CHECK (origen_relacion IN ('manual','importado','reserva')),
  CONSTRAINT clientes_sucursales_cliente_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE
);

CREATE INDEX idx_clientes_sucursales_cliente_id ON public.clientes_sucursales(cliente_id);
CREATE INDEX idx_clientes_sucursales_sucursal_id ON public.clientes_sucursales(sucursal_id);
CREATE INDEX idx_clientes_sucursales_organization_id ON public.clientes_sucursales(organization_id);

CREATE TRIGGER trg_clientes_sucursales_updated_at
BEFORE UPDATE ON public.clientes_sucursales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_sucursales ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2) Policies clientes
-- ============================================================
CREATE POLICY "Owner and GM can view org clientes"
ON public.clientes FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'general_manager'::app_role))
);

CREATE POLICY "Manager and barber can view assigned clientes"
ON public.clientes FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'barber'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.clientes_sucursales cs
    WHERE cs.cliente_id = clientes.id
      AND cs.sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
);

CREATE POLICY "Authorized roles can insert clientes"
ON public.clientes FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'barber'::app_role)
  )
);

CREATE POLICY "Owner and GM can update org clientes"
ON public.clientes FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'general_manager'::app_role))
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'general_manager'::app_role))
);

CREATE POLICY "Manager and barber can update assigned clientes"
ON public.clientes FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'barber'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.clientes_sucursales cs
    WHERE cs.cliente_id = clientes.id
      AND cs.sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'barber'::app_role))
);

-- ============================================================
-- 3) Policies clientes_sucursales
-- ============================================================
CREATE POLICY "Owner and GM can view org clientes_sucursales"
ON public.clientes_sucursales FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'general_manager'::app_role))
);

CREATE POLICY "Manager and barber can view assigned clientes_sucursales"
ON public.clientes_sucursales FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'barber'::app_role))
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

CREATE POLICY "Owner and GM full access clientes_sucursales"
ON public.clientes_sucursales FOR ALL TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'general_manager'::app_role))
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'general_manager'::app_role))
);

CREATE POLICY "Manager and barber manage own sucursal clientes_sucursales"
ON public.clientes_sucursales FOR ALL TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'barber'::app_role))
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'barber'::app_role))
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

-- ============================================================
-- 4) turnos.cliente_id (nullable, sin backfill)
-- ============================================================
ALTER TABLE public.turnos ADD COLUMN cliente_id uuid NULL;
CREATE INDEX idx_turnos_cliente_id ON public.turnos(cliente_id);

-- ============================================================
-- 5) RPC: create_cliente_with_sucursal (atómica)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_cliente_with_sucursal(
  _nombre text,
  _apellido text,
  _telefono text,
  _email text,
  _sucursal_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _suc_org_id uuid;
  _cliente_id uuid;
  _is_owner_or_gm boolean;
  _is_manager_or_barber boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _org_id := public.get_user_organization_id(_user_id);
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _is_owner_or_gm := public.has_role(_user_id, 'owner'::app_role)
                  OR public.has_role(_user_id, 'general_manager'::app_role);
  _is_manager_or_barber := public.has_role(_user_id, 'manager'::app_role)
                        OR public.has_role(_user_id, 'barber'::app_role);

  IF NOT (_is_owner_or_gm OR _is_manager_or_barber) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Sucursal no válida';
  END IF;

  SELECT organization_id INTO _suc_org_id
  FROM public.sucursales
  WHERE id = _sucursal_id;

  IF _suc_org_id IS NULL OR _suc_org_id <> _org_id THEN
    RAISE EXCEPTION 'Sucursal no válida';
  END IF;

  IF NOT _is_owner_or_gm THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_sucursales
      WHERE user_id = _user_id AND sucursal_id = _sucursal_id
    ) THEN
      RAISE EXCEPTION 'Sucursal no válida';
    END IF;
  END IF;

  IF _nombre IS NULL OR length(btrim(_nombre)) = 0 THEN
    RAISE EXCEPTION 'Nombre obligatorio';
  END IF;
  IF _apellido IS NULL OR length(btrim(_apellido)) = 0 THEN
    RAISE EXCEPTION 'Apellido obligatorio';
  END IF;

  INSERT INTO public.clientes (organization_id, nombre, apellido, telefono, email, origen)
  VALUES (
    _org_id,
    btrim(_nombre),
    btrim(_apellido),
    NULLIF(btrim(COALESCE(_telefono, '')), ''),
    NULLIF(btrim(COALESCE(_email, '')), ''),
    'manual'
  )
  RETURNING id INTO _cliente_id;

  INSERT INTO public.clientes_sucursales (organization_id, cliente_id, sucursal_id, origen_relacion)
  VALUES (_org_id, _cliente_id, _sucursal_id, 'manual');

  RETURN _cliente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_cliente_with_sucursal(text, text, text, text, uuid) TO authenticated;