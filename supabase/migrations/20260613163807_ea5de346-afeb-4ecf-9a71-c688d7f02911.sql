ALTER TABLE public.agenda_config
  ADD COLUMN IF NOT EXISTS cancelacion_limite_min integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS modificacion_limite_min integer NOT NULL DEFAULT 120;

UPDATE public.agenda_config
SET cancelacion_limite_min = COALESCE(cancelacion_limite_hs, 2) * 60,
    modificacion_limite_min = COALESCE(modificacion_limite_hs, 2) * 60;

COMMENT ON COLUMN public.agenda_config.cancelacion_limite_hs IS 'DEPRECATED: usar cancelacion_limite_min (en minutos). Mantenida por compatibilidad.';
COMMENT ON COLUMN public.agenda_config.modificacion_limite_hs IS 'DEPRECATED: usar modificacion_limite_min (en minutos). Mantenida por compatibilidad.';
COMMENT ON COLUMN public.agenda_config.cancelacion_limite_min IS 'Minutos mínimos de anticipación para cancelar un turno.';
COMMENT ON COLUMN public.agenda_config.modificacion_limite_min IS 'Minutos mínimos de anticipación para reprogramar un turno.';