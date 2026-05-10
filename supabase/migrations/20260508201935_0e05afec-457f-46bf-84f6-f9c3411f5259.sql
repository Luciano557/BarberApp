-- 1) Add assignment_scope column
ALTER TABLE public.tareas
  ADD COLUMN IF NOT EXISTS assignment_scope text NOT NULL DEFAULT 'individual';

-- 2) Backfill: existing tareas sin asignado_a_id => team
UPDATE public.tareas
SET assignment_scope = 'team'
WHERE tipo = 'tarea' AND asignado_a_id IS NULL;

UPDATE public.tareas
SET assignment_scope = 'individual'
WHERE tipo = 'tarea' AND asignado_a_id IS NOT NULL;

-- 3) Check constraint on values (safe for peticiones because default 'individual' is allowed)
ALTER TABLE public.tareas
  DROP CONSTRAINT IF EXISTS tareas_assignment_scope_check;
ALTER TABLE public.tareas
  ADD CONSTRAINT tareas_assignment_scope_check
  CHECK (assignment_scope IN ('individual', 'team'));

-- 4) Replace open SELECT policy with strict one
DROP POLICY IF EXISTS "Users can view org tareas" ON public.tareas;

CREATE POLICY "Owner GM Manager view org tareas"
ON public.tareas
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Barber view scoped tareas"
ON public.tareas
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'barber'::app_role)
  AND (
    -- peticiones creadas por el barbero
    (tipo = 'peticion' AND creado_por_id = auth.uid())
    -- tareas individuales asignadas a su barbero
    OR (tipo = 'tarea' AND assignment_scope = 'individual' AND asignado_a_id = public.get_user_barbero_id(auth.uid()))
    -- tareas de equipo de su(s) sucursal(es)
    OR (tipo = 'tarea' AND assignment_scope = 'team' AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid())))
  )
);