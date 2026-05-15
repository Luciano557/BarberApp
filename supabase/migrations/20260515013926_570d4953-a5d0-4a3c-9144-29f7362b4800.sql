-- 1. Tabla notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  event_key text NOT NULL,
  type text NOT NULL,
  source_module text NOT NULL,
  source_table text NULL,
  source_id uuid NULL,
  title text NOT NULL,
  body text NULL,
  notification_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_notification_at
  ON public.notifications (organization_id, notification_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_org_source
  ON public.notifications (organization_id, source_module, source_id);

-- Trigger updated_at (reutiliza función existente)
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select organization notifications" ON public.notifications;
CREATE POLICY "select organization notifications"
ON public.notifications
FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "insert organization notifications" ON public.notifications;
CREATE POLICY "insert organization notifications"
ON public.notifications
FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "update organization notifications" ON public.notifications;
CREATE POLICY "update organization notifications"
ON public.notifications
FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

-- 2. Extender notification_reads con notification_id
ALTER TABLE public.notification_reads
  ADD COLUMN IF NOT EXISTS notification_id uuid NULL
  REFERENCES public.notifications(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_reads_user_notification
  ON public.notification_reads (user_id, notification_id)
  WHERE notification_id IS NOT NULL;

-- 3. RPC upsert_notification
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
  _metadata jsonb
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
    title, body, notification_at, metadata
  ) VALUES (
    _organization_id, _event_key, _type, _source_module, _source_table, _source_id,
    _title, _body, COALESCE(_notification_at, now()), COALESCE(_metadata, '{}'::jsonb)
  )
  ON CONFLICT (organization_id, event_key) DO UPDATE
  SET title = EXCLUDED.title,
      body = EXCLUDED.body,
      metadata = EXCLUDED.metadata,
      updated_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;