
-- =============================================
-- Tabla: comision_equipo_config
-- =============================================
CREATE TABLE public.comision_equipo_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  encargado_id uuid NOT NULL REFERENCES public.barberos(id) ON DELETE CASCADE,
  activa boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'branch_only'
    CHECK (scope_type IN ('branch_only', 'multi_branch')),
  sucursal_id uuid REFERENCES public.sucursales(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_scope_sucursal CHECK (
    (scope_type = 'branch_only' AND sucursal_id IS NOT NULL) OR
    (scope_type = 'multi_branch' AND sucursal_id IS NULL)
  )
);

-- Solo una config activa por encargado
CREATE UNIQUE INDEX uq_comision_config_activa
  ON public.comision_equipo_config (encargado_id)
  WHERE activa = true;

-- Enable RLS
ALTER TABLE public.comision_equipo_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access comision_equipo_config"
  ON public.comision_equipo_config
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

CREATE POLICY "Barber can view own comision_equipo_config"
  ON public.comision_equipo_config
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber'::app_role)
    AND encargado_id = get_user_barbero_id(auth.uid())
  );

-- Trigger updated_at
CREATE TRIGGER update_comision_equipo_config_updated_at
  BEFORE UPDATE ON public.comision_equipo_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Tabla: comision_equipo_reglas
-- =============================================
CREATE TABLE public.comision_equipo_reglas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.comision_equipo_config(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  barbero_origen_id uuid NOT NULL REFERENCES public.barberos(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  porcentaje numeric NOT NULL DEFAULT 0 CHECK (porcentaje >= 0 AND porcentaje <= 100),
  activa boolean NOT NULL DEFAULT true,
  vigencia_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Solo una regla abierta por config+barbero
CREATE UNIQUE INDEX uq_regla_abierta_por_barbero
  ON public.comision_equipo_reglas (config_id, barbero_origen_id)
  WHERE activa = true AND vigencia_hasta IS NULL;

-- Enable RLS
ALTER TABLE public.comision_equipo_reglas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access comision_equipo_reglas"
  ON public.comision_equipo_reglas
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

CREATE POLICY "Barber can view own comision_equipo_reglas"
  ON public.comision_equipo_reglas
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber'::app_role)
    AND config_id IN (
      SELECT id FROM public.comision_equipo_config
      WHERE encargado_id = get_user_barbero_id(auth.uid())
    )
  );

-- Trigger updated_at
CREATE TRIGGER update_comision_equipo_reglas_updated_at
  BEFORE UPDATE ON public.comision_equipo_reglas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Trigger 1: No autocomision
-- =============================================
CREATE OR REPLACE FUNCTION public.check_no_autocomision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc_id uuid;
BEGIN
  SELECT encargado_id INTO enc_id
    FROM public.comision_equipo_config
    WHERE id = NEW.config_id;

  IF enc_id = NEW.barbero_origen_id THEN
    RAISE EXCEPTION 'Un encargado no puede comisionar sobre si mismo';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_no_autocomision
  BEFORE INSERT OR UPDATE ON public.comision_equipo_reglas
  FOR EACH ROW
  EXECUTE FUNCTION public.check_no_autocomision();

-- =============================================
-- Trigger 2: Validar sucursal para branch_only
-- =============================================
CREATE OR REPLACE FUNCTION public.check_sucursal_regla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg_scope text;
  cfg_suc uuid;
  barbero_suc uuid;
BEGIN
  SELECT scope_type, sucursal_id
    INTO cfg_scope, cfg_suc
    FROM public.comision_equipo_config
    WHERE id = NEW.config_id;

  IF cfg_scope = 'branch_only' THEN
    SELECT sucursal_id INTO barbero_suc
      FROM public.barberos
      WHERE id = NEW.barbero_origen_id;

    IF barbero_suc IS DISTINCT FROM cfg_suc THEN
      RAISE EXCEPTION 'Encargado de sucursal solo puede comisionar barberos de su misma sucursal';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_sucursal_regla
  BEFORE INSERT OR UPDATE ON public.comision_equipo_reglas
  FOR EACH ROW
  EXECUTE FUNCTION public.check_sucursal_regla();

-- =============================================
-- Trigger 3: No solapamiento temporal
-- =============================================
CREATE OR REPLACE FUNCTION public.check_no_solapamiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.comision_equipo_reglas
    WHERE config_id = NEW.config_id
      AND barbero_origen_id = NEW.barbero_origen_id
      AND id IS DISTINCT FROM NEW.id
      AND vigencia_desde <= COALESCE(NEW.vigencia_hasta, '9999-12-31'::date)
      AND COALESCE(vigencia_hasta, '9999-12-31'::date) >= NEW.vigencia_desde
  ) THEN
    RAISE EXCEPTION 'Existe una regla que se solapa temporalmente para este encargado y barbero';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_no_solapamiento
  BEFORE INSERT OR UPDATE ON public.comision_equipo_reglas
  FOR EACH ROW
  EXECUTE FUNCTION public.check_no_solapamiento();
