ALTER TABLE public.portal_config
ADD COLUMN IF NOT EXISTS cover_position_x SMALLINT NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS cover_position_y SMALLINT NOT NULL DEFAULT 50;

ALTER TABLE public.portal_config
DROP CONSTRAINT IF EXISTS portal_config_cover_position_x_range,
DROP CONSTRAINT IF EXISTS portal_config_cover_position_y_range;

ALTER TABLE public.portal_config
ADD CONSTRAINT portal_config_cover_position_x_range CHECK (cover_position_x BETWEEN 0 AND 100),
ADD CONSTRAINT portal_config_cover_position_y_range CHECK (cover_position_y BETWEEN 0 AND 100);