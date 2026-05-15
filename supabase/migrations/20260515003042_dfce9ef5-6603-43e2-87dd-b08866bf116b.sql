ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tareas_vencimiento_dias_default integer NOT NULL DEFAULT 1;