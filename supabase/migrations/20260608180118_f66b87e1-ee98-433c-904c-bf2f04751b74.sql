-- 1a: Campos en barberos
ALTER TABLE public.barberos
  ADD COLUMN IF NOT EXISTS fecha_baja date,
  ADD COLUMN IF NOT EXISTS motivo_baja text;

-- 1b: Tabla barbero_historial
CREATE TABLE IF NOT EXISTS public.barbero_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  barbero_id uuid NOT NULL REFERENCES public.barberos(id) ON DELETE CASCADE,
  sucursal_id uuid REFERENCES public.sucursales(id) ON DELETE SET NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date,
  motivo_egreso text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bh_barbero ON public.barbero_historial(barbero_id);
CREATE INDEX IF NOT EXISTS idx_bh_org ON public.barbero_historial(organization_id);

-- GRANTs
GRANT SELECT, INSERT, UPDATE ON public.barbero_historial TO authenticated;
GRANT ALL ON public.barbero_historial TO service_role;

-- RLS
ALTER TABLE public.barbero_historial ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: owner / general_manager ven toda su org (patrón replicado de barberos_sucursales)
CREATE POLICY "Owner GM view org barbero_historial"
  ON public.barbero_historial
  FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'general_manager'::app_role)
    )
  );

-- Policy INSERT: misma scope (necesaria para el trigger no-definer; el trigger es SECURITY DEFINER pero igual mantenemos consistencia)
CREATE POLICY "Owner GM insert barbero_historial"
  ON public.barbero_historial
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'general_manager'::app_role)
    )
  );

-- Policy UPDATE: misma scope
CREATE POLICY "Owner GM update barbero_historial"
  ON public.barbero_historial
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'general_manager'::app_role)
    )
  );

-- 1c: Trigger function
CREATE OR REPLACE FUNCTION public.trg_barberos_historial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Egreso: activo true -> false: cerrar fila abierta
  IF OLD.activo = true AND NEW.activo = false THEN
    UPDATE public.barbero_historial
       SET fecha_fin = CURRENT_DATE,
           motivo_egreso = COALESCE(motivo_egreso, NEW.motivo_baja)
     WHERE barbero_id = NEW.id
       AND fecha_fin IS NULL;
  END IF;

  -- Reincorporación: activo false -> true: abrir fila nueva
  IF OLD.activo = false AND NEW.activo = true THEN
    INSERT INTO public.barbero_historial
      (barbero_id, organization_id, sucursal_id, fecha_inicio, created_by)
    VALUES
      (NEW.id, NEW.organization_id, NEW.sucursal_id, CURRENT_DATE, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_barberos_historial ON public.barberos;
CREATE TRIGGER trg_barberos_historial
  AFTER UPDATE OF activo ON public.barberos
  FOR EACH ROW EXECUTE FUNCTION public.trg_barberos_historial();

-- 1d: Backfill de barberos activos actuales (no duplicar si ya hay fila abierta)
INSERT INTO public.barbero_historial
  (barbero_id, organization_id, sucursal_id, fecha_inicio)
SELECT b.id, b.organization_id, b.sucursal_id, b.created_at::date
FROM public.barberos b
WHERE b.activo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.barbero_historial bh
    WHERE bh.barbero_id = b.id AND bh.fecha_fin IS NULL
  );
