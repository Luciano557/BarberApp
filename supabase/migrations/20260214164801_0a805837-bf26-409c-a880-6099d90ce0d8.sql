
-- ============================================================
-- 1. Add deferred closing columns to ingresos
-- ============================================================

-- Entry mode: normal (standard closing from transactions) or diferido (backfilled)
ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS entry_mode text NOT NULL DEFAULT 'normal';

-- When was this backfill performed
ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS backfilled_at timestamptz;

-- Who performed the backfill (references auth.users via uuid)
ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS backfilled_by uuid;

-- Reason for the backfill
ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS backfill_reason text;

-- Optional free-text note
ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS backfill_note text;

-- ============================================================
-- 2. Create ingresos_items table for deferred closing detail
-- ============================================================
CREATE TABLE public.ingresos_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  ingreso_id integer NOT NULL REFERENCES public.ingresos(id) ON DELETE CASCADE,
  barbero_id uuid NOT NULL REFERENCES public.barberos(id),
  servicio_id uuid REFERENCES public.servicios(id),
  linea_id uuid REFERENCES public.lineas(id),
  servicio_nombre text NOT NULL DEFAULT '',
  payment_method text NOT NULL DEFAULT 'efectivo',
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. RLS for ingresos_items
-- ============================================================
ALTER TABLE public.ingresos_items ENABLE ROW LEVEL SECURITY;

-- Owner and manager: full access within org
CREATE POLICY "Owner and manager full access ingresos_items"
  ON public.ingresos_items
  FOR ALL
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

-- Barber: read-only, own records only
CREATE POLICY "Barber can view own ingresos_items"
  ON public.ingresos_items
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber')
    AND barbero_id = get_user_barbero_id(auth.uid())
  );

-- ============================================================
-- 4. Add index for performance
-- ============================================================
CREATE INDEX idx_ingresos_items_ingreso_id ON public.ingresos_items(ingreso_id);
CREATE INDEX idx_ingresos_entry_mode ON public.ingresos(entry_mode);
