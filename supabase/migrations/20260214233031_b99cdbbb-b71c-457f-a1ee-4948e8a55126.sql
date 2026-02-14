
-- Drop existing policies on tareas
DROP POLICY IF EXISTS "Barbers can create peticiones" ON public.tareas;
DROP POLICY IF EXISTS "Barbers can view own tasks" ON public.tareas;
DROP POLICY IF EXISTS "Owner/Manager full access tareas" ON public.tareas;

-- Everyone in org can view all tareas
CREATE POLICY "Users can view org tareas"
ON public.tareas FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

-- Only owner/manager can insert tareas (tipo='tarea')
CREATE POLICY "Owner/Manager can insert tareas"
ON public.tareas FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- Barbers can insert peticiones only
CREATE POLICY "Barbers can create peticiones"
ON public.tareas FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND tipo = 'peticion'
  AND creado_por_id = auth.uid()
  AND has_role(auth.uid(), 'barber')
);

-- Owner/Manager can update/delete
CREATE POLICY "Owner/Manager can update tareas"
ON public.tareas FOR UPDATE
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

CREATE POLICY "Owner/Manager can delete tareas"
ON public.tareas FOR DELETE
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

-- Barbers can update estado of tasks assigned to them
CREATE POLICY "Barbers can update assigned task estado"
ON public.tareas FOR UPDATE
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber')
  AND asignado_a_id = get_user_barbero_id(auth.uid())
);
