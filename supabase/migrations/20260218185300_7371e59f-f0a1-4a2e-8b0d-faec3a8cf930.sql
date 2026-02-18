-- Add configurable expiration days for peticiones (default 60)
ALTER TABLE public.organizations
ADD COLUMN peticiones_vencimiento_dias integer NOT NULL DEFAULT 60;