-- =========================================================
-- MercadoPago Integration: Phase 1 & 2 Schema
-- =========================================================

-- 1. mp_connections
--    Stores OAuth tokens per organization.
--    Token columns are NOT accessible via client RLS policies —
--    only readable through SECURITY DEFINER helper functions.
-- ---------------------------------------------------------
CREATE TABLE public.mp_connections (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mp_user_id      TEXT        NOT NULL,
  access_token    TEXT        NOT NULL,
  refresh_token   TEXT        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id)
);

ALTER TABLE public.mp_connections ENABLE ROW LEVEL SECURITY;
-- No RLS policies → authenticated users are blocked from direct table access.
-- All reads/writes happen via service-role edge functions or SECURITY DEFINER RPCs.

-- Safe RPC: org members can check *if* they are connected, without ever seeing the tokens.
CREATE OR REPLACE FUNCTION public.get_mp_connection_status(_org_id UUID)
RETURNS TABLE (is_connected BOOLEAN, mp_user_id TEXT, expires_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    true            AS is_connected,
    mp_user_id,
    expires_at
  FROM public.mp_connections
  WHERE organization_id = _org_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_mp_connection_status(UUID) TO authenticated;

-- RPC to delete own connection (used by disconnect button).
CREATE OR REPLACE FUNCTION public.delete_mp_connection(_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Caller must belong to the org.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND organization_id = _org_id
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  DELETE FROM public.mp_connections WHERE organization_id = _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_mp_connection(UUID) TO authenticated;


-- 2. mp_devices
--    Stores MercadoPago Point terminals per organization/sucursal.
-- ---------------------------------------------------------
CREATE TABLE public.mp_devices (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID       NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id    UUID        REFERENCES public.sucursales(id) ON DELETE SET NULL,
  mp_device_id   TEXT        NOT NULL,
  name           TEXT,
  operating_mode TEXT        DEFAULT 'PDV',
  activo         BOOLEAN     DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, mp_device_id)
);

ALTER TABLE public.mp_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_manage_mp_devices"
  ON public.mp_devices FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX idx_mp_devices_org       ON public.mp_devices (organization_id);
CREATE INDEX idx_mp_devices_sucursal  ON public.mp_devices (sucursal_id) WHERE sucursal_id IS NOT NULL;


-- 3. mp_webhook_log
--    Append-only audit log for all webhook events received from MercadoPago.
--    Service-role only (no client RLS policies).
-- ---------------------------------------------------------
CREATE TABLE public.mp_webhook_log (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id    UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  payment_intent_id  TEXT,
  mp_payment_id      TEXT,
  event_type         TEXT,
  payload            JSONB,
  received_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mp_webhook_log ENABLE ROW LEVEL SECURITY;
-- No RLS policies → service-role only.

CREATE INDEX idx_mp_webhook_log_intent ON public.mp_webhook_log (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;


-- 4. Extend venta table with MP Point fields
-- ---------------------------------------------------------
ALTER TABLE public.venta
  ADD COLUMN IF NOT EXISTS mp_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_device_id          TEXT,
  ADD COLUMN IF NOT EXISTS mp_status             TEXT;
  -- mp_status values: 'approved' | 'rejected' | 'cancelled' | 'error'

CREATE INDEX IF NOT EXISTS idx_venta_mp_payment_intent
  ON public.venta (mp_payment_intent_id)
  WHERE mp_payment_intent_id IS NOT NULL;
