ALTER TABLE public.tareas
  ALTER COLUMN creado_por_id DROP NOT NULL;

COMMENT ON COLUMN public.tareas.creado_por_id IS
  'NULL cuando la tarea fue generada automáticamente por el '
  'motor de recurrencia (process_tareas_recurrentes). '
  'En ese caso el origen está en tareas_recurrentes.created_by.';