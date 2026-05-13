
-- Validation function (IMMUTABLE so it can be used in CHECK)
CREATE OR REPLACE FUNCTION public.validate_portal_links(p_links jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  item jsonb;
BEGIN
  IF p_links IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(p_links) <> 'array' THEN
    RAISE EXCEPTION 'links must be a JSON array';
  END IF;
  IF jsonb_array_length(p_links) > 4 THEN
    RAISE EXCEPTION 'Máximo 4 links personalizados';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_links) LOOP
    IF jsonb_typeof(item) <> 'object' THEN
      RAISE EXCEPTION 'each link must be an object';
    END IF;
    IF NOT (item ? 'label' AND item ? 'url' AND item ? 'active' AND item ? 'sort_order') THEN
      RAISE EXCEPTION 'link missing required fields';
    END IF;
    IF jsonb_typeof(item->'label') <> 'string'
       OR char_length(item->>'label') < 1
       OR char_length(item->>'label') > 80 THEN
      RAISE EXCEPTION 'invalid link label';
    END IF;
    IF jsonb_typeof(item->'url') <> 'string'
       OR (item->>'url') !~ '^https?://'
       OR char_length(item->>'url') > 500 THEN
      RAISE EXCEPTION 'invalid link url';
    END IF;
    IF jsonb_typeof(item->'active') <> 'boolean' THEN
      RAISE EXCEPTION 'link.active must be boolean';
    END IF;
    IF jsonb_typeof(item->'sort_order') <> 'number' THEN
      RAISE EXCEPTION 'link.sort_order must be number';
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- Table
CREATE TABLE public.portal_config (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  logo_path text,
  description text,
  primary_color text,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_config_description_len CHECK (description IS NULL OR char_length(description) <= 240),
  CONSTRAINT portal_config_color_format CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT portal_config_links_valid CHECK (public.validate_portal_links(links))
);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION public.portal_config_touch_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER portal_config_touch
BEFORE INSERT OR UPDATE ON public.portal_config
FOR EACH ROW EXECUTE FUNCTION public.portal_config_touch_trg();

-- RLS
ALTER TABLE public.portal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_config_select_org_members"
ON public.portal_config FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "portal_config_insert_admins"
ON public.portal_config FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "portal_config_update_admins"
ON public.portal_config FOR UPDATE
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

CREATE POLICY "portal_config_delete_admins"
ON public.portal_config FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portal-logos',
  'portal-logos',
  true,
  1048576,
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies
CREATE POLICY "portal_logos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'portal-logos');

CREATE POLICY "portal_logos_admins_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portal-logos'
  AND (storage.foldername(name))[1] = public.get_user_organization_id(auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  AND lower(name) ~ '\.(png|jpg|jpeg|webp)$'
);

CREATE POLICY "portal_logos_admins_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portal-logos'
  AND (storage.foldername(name))[1] = public.get_user_organization_id(auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'portal-logos'
  AND (storage.foldername(name))[1] = public.get_user_organization_id(auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  AND lower(name) ~ '\.(png|jpg|jpeg|webp)$'
);

CREATE POLICY "portal_logos_admins_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'portal-logos'
  AND (storage.foldername(name))[1] = public.get_user_organization_id(auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);
