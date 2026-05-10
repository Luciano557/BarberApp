ALTER TABLE public.tareas
  ADD COLUMN IF NOT EXISTS completada_por_id uuid NULL,
  ADD COLUMN IF NOT EXISTS completada_por_nombre text NULL,
  ADD COLUMN IF NOT EXISTS completada_at timestamptz NULL;