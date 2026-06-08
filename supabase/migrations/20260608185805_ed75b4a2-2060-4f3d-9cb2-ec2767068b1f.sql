
-- 1a) Campo de fecha de desactivación
ALTER TABLE public.sucursales
  ADD COLUMN IF NOT EXISTS fecha_desactivacion timestamptz;

-- 1b) Tabla snapshot del estado del equipo al desactivar
CREATE TABLE IF NOT EXISTS public.sucursal_barberos_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  barbero_id uuid NOT NULL REFERENCES public.barberos(id) ON DELETE CASCADE,
  disponible boolean NOT NULL,
  tipo text NOT NULL,
  dias_semana smallint[],
  fecha_inicio date,
  fecha_fin date,
  snapshotted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sucursal_id, barbero_id)
);

CREATE INDEX IF NOT EXISTS idx_sbs_sucursal
  ON public.sucursal_barberos_snapshot(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_sbs_org
  ON public.sucursal_barberos_snapshot(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sucursal_barberos_snapshot TO authenticated;
GRANT ALL ON public.sucursal_barberos_snapshot TO service_role;

ALTER TABLE public.sucursal_barberos_snapshot ENABLE ROW LEVEL SECURITY;

-- RLS: solo owner / general_manager dentro de su organización
CREATE POLICY "Owner GM view sucursal_barberos_snapshot"
  ON public.sucursal_barberos_snapshot
  FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
  );

CREATE POLICY "Owner GM insert sucursal_barberos_snapshot"
  ON public.sucursal_barberos_snapshot
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
  );

CREATE POLICY "Owner GM update sucursal_barberos_snapshot"
  ON public.sucursal_barberos_snapshot
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
  );

CREATE POLICY "Owner GM delete sucursal_barberos_snapshot"
  ON public.sucursal_barberos_snapshot
  FOR DELETE TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
  );
