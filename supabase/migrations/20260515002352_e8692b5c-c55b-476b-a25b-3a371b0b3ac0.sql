ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS fecha_inicio date NULL;

UPDATE public.tareas
  SET fecha_inicio = fecha_limite
  WHERE fecha_inicio IS NULL AND fecha_limite IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tareas_org_fecha_inicio
  ON public.tareas (organization_id, fecha_inicio);