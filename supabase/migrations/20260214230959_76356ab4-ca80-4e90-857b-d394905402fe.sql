
-- Add recurrence pattern columns
ALTER TABLE public.tareas 
  ADD COLUMN recurrencia_tipo TEXT DEFAULT 'dias',
  ADD COLUMN recurrencia_dia_semana INTEGER,
  ADD COLUMN recurrencia_semana_del_mes INTEGER,
  ADD COLUMN dias_para_limite INTEGER;

COMMENT ON COLUMN public.tareas.recurrencia_tipo IS 'dias | semanal | quincenal_dia | primer_dia_mes | segundo_dia_mes';
COMMENT ON COLUMN public.tareas.recurrencia_dia_semana IS '0=domingo, 1=lunes, ..., 6=sabado';
COMMENT ON COLUMN public.tareas.recurrencia_semana_del_mes IS '1=primera semana, 2=segunda semana';
COMMENT ON COLUMN public.tareas.dias_para_limite IS 'Dias despues de la fecha de inicio para el vencimiento';
