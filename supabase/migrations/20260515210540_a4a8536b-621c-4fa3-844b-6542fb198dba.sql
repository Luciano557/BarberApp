-- =========================================================
-- Fase 1: Centro de Notificaciones — base segura
-- =========================================================

-- 1. Extend notifications (preparatory fields, all nullable)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS sucursal_id uuid NULL,
  ADD COLUMN IF NOT EXISTS category text NULL,
  ADD COLUMN IF NOT EXISTS summary text NULL,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS actor_name text NULL,
  ADD COLUMN IF NOT EXISTS actor_account_type text NULL,
  ADD COLUMN IF NOT EXISTS authorized_by_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS authorized_by_name text NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL;

-- 2. notification_deliveries
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamptz NULL,
  hidden_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_deliveries_user_read
  ON public.notification_deliveries (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_org_user_created
  ON public.notification_deliveries (organization_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_notification
  ON public.notification_deliveries (notification_id);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_hidden
  ON public.notification_deliveries (hidden_at);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own deliveries" ON public.notification_deliveries;
CREATE POLICY "select own deliveries"
ON public.notification_deliveries
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND organization_id = public.get_user_organization_id(auth.uid())
);

DROP POLICY IF EXISTS "update own deliveries" ON public.notification_deliveries;
CREATE POLICY "update own deliveries"
ON public.notification_deliveries
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND organization_id = public.get_user_organization_id(auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = public.get_user_organization_id(auth.uid())
);
-- No INSERT/DELETE policies for client. Use SECURITY DEFINER RPCs.

-- 3. upsert_notification_delivery (self-only in this phase)
CREATE OR REPLACE FUNCTION public.upsert_notification_delivery(
  _notification_id uuid,
  _user_id uuid
)
RETURNS public.notification_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _caller_org uuid;
  _notif_org uuid;
  _row public.notification_deliveries;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _notification_id IS NULL OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Parametros invalidos';
  END IF;

  -- Phase 1: only allow self-delivery from clients.
  -- Cross-user delivery will require a dedicated admin/server-side function.
  IF _user_id <> _caller THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _caller_org := public.get_user_organization_id(_caller);
  IF _caller_org IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT organization_id INTO _notif_org
  FROM public.notifications WHERE id = _notification_id;
  IF _notif_org IS NULL OR _notif_org <> _caller_org THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.notification_deliveries (notification_id, organization_id, user_id)
  VALUES (_notification_id, _notif_org, _caller)
  ON CONFLICT (notification_id, user_id) DO UPDATE
    SET notification_id = EXCLUDED.notification_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

-- 4. Replace upsert_notification with extended signature.
-- Existing callers pass the original 10 named params; new params have DEFAULT NULL.
DROP FUNCTION IF EXISTS public.upsert_notification(uuid, text, text, text, text, uuid, text, text, timestamptz, jsonb);

CREATE OR REPLACE FUNCTION public.upsert_notification(
  _organization_id uuid,
  _event_key text,
  _type text,
  _source_module text,
  _source_table text,
  _source_id uuid,
  _title text,
  _body text,
  _notification_at timestamptz,
  _metadata jsonb,
  _sucursal_id uuid DEFAULT NULL,
  _category text DEFAULT NULL,
  _summary text DEFAULT NULL,
  _actor_user_id uuid DEFAULT NULL,
  _actor_name text DEFAULT NULL,
  _actor_account_type text DEFAULT NULL,
  _authorized_by_user_id uuid DEFAULT NULL,
  _authorized_by_name text DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _deliver_to_caller boolean DEFAULT true
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_org uuid;
  _row public.notifications;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _user_org := public.get_user_organization_id(_user_id);
  IF _user_org IS NULL OR _user_org <> _organization_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _event_key IS NULL OR length(btrim(_event_key)) = 0 THEN
    RAISE EXCEPTION 'event_key requerido';
  END IF;

  INSERT INTO public.notifications (
    organization_id, event_key, type, source_module, source_table, source_id,
    title, body, notification_at, metadata,
    sucursal_id, category, summary,
    actor_user_id, actor_name, actor_account_type,
    authorized_by_user_id, authorized_by_name, expires_at
  ) VALUES (
    _organization_id, _event_key, _type, _source_module, _source_table, _source_id,
    _title, _body, COALESCE(_notification_at, now()), COALESCE(_metadata, '{}'::jsonb),
    _sucursal_id, _category, _summary,
    _actor_user_id, _actor_name, _actor_account_type,
    _authorized_by_user_id, _authorized_by_name, _expires_at
  )
  ON CONFLICT (organization_id, event_key) DO UPDATE
  SET title       = EXCLUDED.title,
      body        = EXCLUDED.body,
      summary     = COALESCE(EXCLUDED.summary, public.notifications.summary),
      category    = COALESCE(EXCLUDED.category, public.notifications.category),
      sucursal_id = COALESCE(EXCLUDED.sucursal_id, public.notifications.sucursal_id),
      metadata    = EXCLUDED.metadata,
      expires_at  = COALESCE(EXCLUDED.expires_at, public.notifications.expires_at),
      updated_at  = now()
  RETURNING * INTO _row;

  -- Auto-deliver to caller (preserves current visibility model:
  -- each user only sees what they already encounter via useTareas)
  IF _deliver_to_caller THEN
    INSERT INTO public.notification_deliveries (notification_id, organization_id, user_id)
    VALUES (_row.id, _row.organization_id, _user_id)
    ON CONFLICT (notification_id, user_id) DO NOTHING;
  END IF;

  RETURN _row;
END;
$$;