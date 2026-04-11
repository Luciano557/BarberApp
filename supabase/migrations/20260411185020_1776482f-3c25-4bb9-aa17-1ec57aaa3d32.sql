
-- Table: bono_fijo_config
CREATE TABLE public.bono_fijo_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  sucursal_id uuid,
  barbero_id uuid NOT NULL,
  monto numeric NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date,
  repeat_preset text NOT NULL DEFAULT 'monthly',
  repeat_frequency text,
  repeat_interval integer DEFAULT 1,
  repeat_byweekday integer[],
  proxima_fecha date NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: only one active bonus per employee
CREATE UNIQUE INDEX uq_bono_fijo_activo_por_barbero
  ON public.bono_fijo_config (barbero_id)
  WHERE (activa = true);

-- Table: bono_fijo_ocurrencias
CREATE TABLE public.bono_fijo_ocurrencias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  sucursal_id uuid,
  config_id uuid NOT NULL,
  barbero_id uuid NOT NULL,
  monto numeric NOT NULL,
  fecha date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index to prevent duplicate occurrences
CREATE UNIQUE INDEX uq_bono_fijo_ocurrencia_config_fecha
  ON public.bono_fijo_ocurrencias (config_id, fecha);

-- Indexes for performance
CREATE INDEX idx_bono_fijo_config_org ON public.bono_fijo_config (organization_id);
CREATE INDEX idx_bono_fijo_config_barbero ON public.bono_fijo_config (barbero_id);
CREATE INDEX idx_bono_fijo_ocurrencias_org ON public.bono_fijo_ocurrencias (organization_id);
CREATE INDEX idx_bono_fijo_ocurrencias_barbero ON public.bono_fijo_ocurrencias (barbero_id);

-- Updated_at trigger for config
CREATE TRIGGER update_bono_fijo_config_updated_at
  BEFORE UPDATE ON public.bono_fijo_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: bono_fijo_config
ALTER TABLE public.bono_fijo_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access bono_fijo_config"
  ON public.bono_fijo_config FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'general_manager') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'general_manager') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Barber can view own bono_fijo_config"
  ON public.bono_fijo_config FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber')
    AND barbero_id = get_user_barbero_id(auth.uid())
  );

-- RLS: bono_fijo_ocurrencias
ALTER TABLE public.bono_fijo_ocurrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access bono_fijo_ocurrencias"
  ON public.bono_fijo_ocurrencias FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'general_manager') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'general_manager') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Barber can view own bono_fijo_ocurrencias"
  ON public.bono_fijo_ocurrencias FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber')
    AND barbero_id = get_user_barbero_id(auth.uid())
  );
