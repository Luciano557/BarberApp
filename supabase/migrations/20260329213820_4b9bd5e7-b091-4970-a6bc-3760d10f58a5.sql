-- Create sucursal_settings table for per-branch configuration
CREATE TABLE public.sucursal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  capacidad_diaria integer NOT NULL DEFAULT 18,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sucursal_id)
);

-- Enable RLS
ALTER TABLE public.sucursal_settings ENABLE ROW LEVEL SECURITY;

-- Owner, GM, and Manager can read/write within their org
CREATE POLICY "Owner GM Manager full access sucursal_settings"
  ON public.sucursal_settings
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

-- Barbers can read settings
CREATE POLICY "Barbers can view sucursal_settings"
  ON public.sucursal_settings
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber'::app_role)
  );

-- Auto-update updated_at
CREATE TRIGGER update_sucursal_settings_updated_at
  BEFORE UPDATE ON public.sucursal_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();