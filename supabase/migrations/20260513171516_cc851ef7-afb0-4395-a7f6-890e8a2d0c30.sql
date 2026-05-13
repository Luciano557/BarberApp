ALTER TABLE public.portal_config
ADD COLUMN IF NOT EXISTS cover_zoom NUMERIC NOT NULL DEFAULT 1;

ALTER TABLE public.portal_config
DROP CONSTRAINT IF EXISTS portal_config_cover_zoom_range;

ALTER TABLE public.portal_config
ADD CONSTRAINT portal_config_cover_zoom_range
CHECK (cover_zoom >= 1 AND cover_zoom <= 3);