
-- =========================================================================
-- Corrección: agrega general_manager a las políticas INSERT/UPDATE/DELETE
-- de tareas_recurrentes, alineándolas con las políticas equivalentes en
-- public.tareas.
-- =========================================================================

DROP POLICY IF EXISTS "Owner/Manager can insert tareas_recurrentes"
  ON public.tareas_recurrentes;
DROP POLICY IF EXISTS "Owner/Manager can update tareas_recurrentes"
  ON public.tareas_recurrentes;
DROP POLICY IF EXISTS "Owner/Manager can delete tareas_recurrentes"
  ON public.tareas_recurrentes;

CREATE POLICY "Owner GM Manager can insert tareas_recurrentes"
  ON public.tareas_recurrentes
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'general_manager'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "Owner GM Manager can update tareas_recurrentes"
  ON public.tareas_recurrentes
  FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'general_manager'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "Owner GM Manager can delete tareas_recurrentes"
  ON public.tareas_recurrentes
  FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'general_manager'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );
