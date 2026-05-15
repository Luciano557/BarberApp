CREATE TABLE IF NOT EXISTS public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user_org
  ON public.notification_reads (user_id, organization_id);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification reads"
ON public.notification_reads
FOR SELECT
USING (
  auth.uid() = user_id
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "Users can insert their own notification reads"
ON public.notification_reads
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "Users can delete their own notification reads"
ON public.notification_reads
FOR DELETE
USING (
  auth.uid() = user_id
  AND organization_id = public.get_user_organization_id(auth.uid())
);