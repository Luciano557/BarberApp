-- 1. Drop leftover phone migration views and backup tables
DROP VIEW IF EXISTS public._phone_migration_report;
DROP VIEW IF EXISTS public._phone_dups_report;
DROP TABLE IF EXISTS public._backup_phones_20260520;
DROP TABLE IF EXISTS public._backup_phones_remove_ar9_20260520;

-- 2. Tighten WITH CHECK on sucursal account UPDATE policy for tareas
DROP POLICY IF EXISTS "Sucursal account update tareas" ON public.tareas;
CREATE POLICY "Sucursal account update tareas"
  ON public.tareas
  FOR UPDATE
  USING (
    (organization_id = get_user_organization_id(auth.uid()))
    AND is_sucursal_account(auth.uid())
    AND ((sucursal_id IS NULL) OR (sucursal_id IN (SELECT get_user_sucursal_ids(auth.uid()))))
  )
  WITH CHECK (
    (organization_id = get_user_organization_id(auth.uid()))
    AND is_sucursal_account(auth.uid())
    AND (sucursal_id IN (SELECT get_user_sucursal_ids(auth.uid())))
  );

-- 3. Restrict barber SELECT on turnos to their own appointments
DROP POLICY IF EXISTS "Barber can view sucursal turnos" ON public.turnos;
CREATE POLICY "Barber can view own turnos"
  ON public.turnos
  FOR SELECT
  USING (
    (organization_id = get_user_organization_id(auth.uid()))
    AND has_role(auth.uid(), 'barber'::app_role)
    AND (barbero_id = get_user_barbero_id(auth.uid()))
  );