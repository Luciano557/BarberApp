ALTER TABLE public.tareas
  DROP COLUMN IF EXISTS recurrencia_tipo,
  DROP COLUMN IF EXISTS frecuencia_dias,
  DROP COLUMN IF EXISTS recurrencia_dia_semana,
  DROP COLUMN IF EXISTS recurrencia_semana_del_mes,
  DROP COLUMN IF EXISTS dias_para_limite,
  DROP COLUMN IF EXISTS proxima_fecha;