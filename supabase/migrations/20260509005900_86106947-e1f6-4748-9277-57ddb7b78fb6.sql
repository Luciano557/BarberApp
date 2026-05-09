-- 1) Nueva tabla comision_productos_config
CREATE TABLE IF NOT EXISTS public.comision_productos_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sucursal_id uuid NULL,
  barbero_id uuid NOT NULL,
  porcentaje numeric NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  activa boolean NOT NULL DEFAULT true,
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique parcial: una sola configuración activa por barbero
CREATE UNIQUE INDEX IF NOT EXISTS uq_comision_productos_activa_por_barbero
  ON public.comision_productos_config (barbero_id)
  WHERE activa = true;

CREATE INDEX IF NOT EXISTS idx_comision_productos_org ON public.comision_productos_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_comision_productos_barbero ON public.comision_productos_config(barbero_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_comision_productos_updated_at ON public.comision_productos_config;
CREATE TRIGGER trg_comision_productos_updated_at
BEFORE UPDATE ON public.comision_productos_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.comision_productos_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Barber can view own comision_productos_config" ON public.comision_productos_config;
CREATE POLICY "Barber can view own comision_productos_config"
ON public.comision_productos_config
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'barber'::app_role)
  AND barbero_id = public.get_user_barbero_id(auth.uid())
);

DROP POLICY IF EXISTS "Owner GM Manager full access comision_productos_config" ON public.comision_productos_config;
CREATE POLICY "Owner GM Manager full access comision_productos_config"
ON public.comision_productos_config
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

-- 2) productos_sucursal: configuración de comisión por producto/sucursal
ALTER TABLE public.productos_sucursal
  ADD COLUMN IF NOT EXISTS comision_modo text NOT NULL DEFAULT 'barbero',
  ADD COLUMN IF NOT EXISTS comision_porcentaje numeric NULL;

ALTER TABLE public.productos_sucursal
  DROP CONSTRAINT IF EXISTS productos_sucursal_comision_modo_check;
ALTER TABLE public.productos_sucursal
  ADD CONSTRAINT productos_sucursal_comision_modo_check
  CHECK (comision_modo IN ('barbero','ninguna','personalizada'));

ALTER TABLE public.productos_sucursal
  DROP CONSTRAINT IF EXISTS productos_sucursal_comision_porcentaje_check;
ALTER TABLE public.productos_sucursal
  ADD CONSTRAINT productos_sucursal_comision_porcentaje_check
  CHECK (comision_porcentaje IS NULL OR (comision_porcentaje >= 0 AND comision_porcentaje <= 100));

-- 3) ingresos: total de comisión por productos
ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS comision_productos numeric NOT NULL DEFAULT 0;

-- 4) ingresos_items_productos: snapshots por línea
ALTER TABLE public.ingresos_items_productos
  ADD COLUMN IF NOT EXISTS precio_costo_snap numeric NULL,
  ADD COLUMN IF NOT EXISTS comision_modo_snap text NULL,
  ADD COLUMN IF NOT EXISTS comision_pct_snap numeric NULL,
  ADD COLUMN IF NOT EXISTS comision_monto numeric NOT NULL DEFAULT 0;