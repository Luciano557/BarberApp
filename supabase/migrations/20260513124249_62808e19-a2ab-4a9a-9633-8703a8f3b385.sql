ALTER TABLE public.agenda_config
ADD COLUMN IF NOT EXISTS anticipacion_minima_reserva_min INTEGER NOT NULL DEFAULT 30 CHECK (anticipacion_minima_reserva_min >= 0);