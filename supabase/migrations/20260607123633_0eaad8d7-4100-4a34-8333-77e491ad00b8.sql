-- Etapa 4: backfill de recetas para tareas huérfanas (recurrente=true sin recurrencia_id).
-- Las huérfanas existentes ya están completadas; las recetas se crean PAUSADAS (activo=false)
-- para no reactivar accidentalmente ciclos antiguos.

BEGIN;

-- 1) Tareas mal etiquetadas (recurrente=true sin preset válido): desmarcar.
UPDATE public.tareas
   SET recurrente = false
 WHERE recurrente = true
   AND recurrencia_id IS NULL
   AND (repeat_preset IS NULL OR repeat_preset = 'never');

-- 2) Crear receta + vincular en una sola pasada con CTEs.
WITH huerfanas AS (
  SELECT *
    FROM public.tareas
   WHERE recurrente = true
     AND recurrencia_id IS NULL
     AND repeat_preset IS NOT NULL
     AND repeat_preset <> 'never'
),
nuevas_recetas AS (
  INSERT INTO public.tareas_recurrentes (
    organization_id, sucursal_id, titulo, descripcion,
    assignment_scope, asignado_a, asignado_nombre, hora,
    repeat_preset, repeat_frequency, repeat_interval, repeat_byweekday,
    fecha_inicio, proxima_fecha, activo, created_by
  )
  SELECT
    h.organization_id, h.sucursal_id, h.titulo, h.descripcion,
    h.assignment_scope, h.asignado_a_id, h.asignado_a_nombre, h.hora,
    h.repeat_preset, h.repeat_frequency, h.repeat_interval, h.repeat_byweekday,
    h.fecha_inicio,
    (
      WITH RECURSIVE step(d) AS (
        SELECT h.fecha_inicio
        UNION ALL
        SELECT public._calc_next_tarea_date(
                 d, h.repeat_preset, h.repeat_frequency,
                 h.repeat_interval, h.repeat_byweekday)
          FROM step
         WHERE d < CURRENT_DATE
      )
      SELECT d FROM step WHERE d >= CURRENT_DATE LIMIT 1
    ),
    false,
    h.creado_por_id
  FROM huerfanas h
  RETURNING id, titulo, sucursal_id, fecha_inicio
)
UPDATE public.tareas t
   SET recurrencia_id = nr.id
  FROM nuevas_recetas nr
 WHERE t.recurrente = true
   AND t.recurrencia_id IS NULL
   AND t.titulo = nr.titulo
   AND t.sucursal_id = nr.sucursal_id
   AND t.fecha_inicio = nr.fecha_inicio;

COMMIT;