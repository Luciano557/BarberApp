
-- barberos: Owner full access → Owner + GM full access
DROP POLICY IF EXISTS "Owner full access org barberos" ON public.barberos;
CREATE POLICY "Owner and GM full access org barberos" ON public.barberos
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

-- organizations
DROP POLICY IF EXISTS "Owner can update own organization" ON public.organizations;
CREATE POLICY "Owner and GM can update own organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)))
  WITH CHECK (id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

-- profiles
DROP POLICY IF EXISTS "Owner can update org profiles" ON public.profiles;
CREATE POLICY "Owner and GM can update org profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

DROP POLICY IF EXISTS "Owner can view org profiles" ON public.profiles;
CREATE POLICY "Owner and GM can view org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

-- user_roles
DROP POLICY IF EXISTS "Owner can view org user roles" ON public.user_roles;
CREATE POLICY "Owner and GM can view org user roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)) AND user_id IN (SELECT id FROM profiles WHERE organization_id = get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Owner can insert org user roles" ON public.user_roles;
CREATE POLICY "Owner and GM can insert org user roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)) AND user_id IN (SELECT id FROM profiles WHERE organization_id = get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Owner can update org user roles" ON public.user_roles;
CREATE POLICY "Owner and GM can update org user roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)) AND user_id IN (SELECT id FROM profiles WHERE organization_id = get_user_organization_id(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)) AND user_id IN (SELECT id FROM profiles WHERE organization_id = get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Owner can delete org user roles" ON public.user_roles;
CREATE POLICY "Owner and GM can delete org user roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)) AND user_id IN (SELECT id FROM profiles WHERE organization_id = get_user_organization_id(auth.uid())));

-- user_sucursales
DROP POLICY IF EXISTS "Owner full access user_sucursales" ON public.user_sucursales;
CREATE POLICY "Owner and GM full access user_sucursales" ON public.user_sucursales
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

-- sucursales
DROP POLICY IF EXISTS "Owner full access sucursales" ON public.sucursales;
CREATE POLICY "Owner and GM full access sucursales" ON public.sucursales
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

-- ingresos delete
DROP POLICY IF EXISTS "Owner can delete org ingresos" ON public.ingresos;
CREATE POLICY "Owner and GM can delete org ingresos" ON public.ingresos
  FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

-- access_logs
DROP POLICY IF EXISTS "Owner can view org access logs" ON public.access_logs;
CREATE POLICY "Owner and GM can view org access logs" ON public.access_logs
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

-- Egresos
DROP POLICY IF EXISTS "Owner and manager full access Egresos" ON public."Egresos";
CREATE POLICY "Owner manager and GM full access Egresos" ON public."Egresos"
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- ReportesMensuales
DROP POLICY IF EXISTS "Owner and manager full access ReportesMensuales" ON public."ReportesMensuales";
CREATE POLICY "Owner manager and GM full access ReportesMensuales" ON public."ReportesMensuales"
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- descuentos
DROP POLICY IF EXISTS "Owner and manager full access descuentos" ON public.descuentos;
CREATE POLICY "Owner manager and GM full access descuentos" ON public.descuentos
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- deudas
DROP POLICY IF EXISTS "Owner and manager full access deudas" ON public.deudas;
CREATE POLICY "Owner manager and GM full access deudas" ON public.deudas
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- extras
DROP POLICY IF EXISTS "Owner and manager full access extras" ON public.extras;
CREATE POLICY "Owner manager and GM full access extras" ON public.extras
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- ingresos insert/update/view
DROP POLICY IF EXISTS "Owner and manager can insert org ingresos" ON public.ingresos;
CREATE POLICY "Owner GM and manager can insert org ingresos" ON public.ingresos
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "Owner and manager can update org ingresos" ON public.ingresos;
CREATE POLICY "Owner GM and manager can update org ingresos" ON public.ingresos
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "Owner and manager can view org ingresos" ON public.ingresos;
CREATE POLICY "Owner GM and manager can view org ingresos" ON public.ingresos
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- ingresos_items
DROP POLICY IF EXISTS "Owner and manager full access ingresos_items" ON public.ingresos_items;
CREATE POLICY "Owner GM and manager full access ingresos_items" ON public.ingresos_items
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- inversiones
DROP POLICY IF EXISTS "Owner and manager full access inversiones" ON public.inversiones;
CREATE POLICY "Owner GM and manager full access inversiones" ON public.inversiones
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- lineas
DROP POLICY IF EXISTS "Owner and manager full access lineas" ON public.lineas;
CREATE POLICY "Owner GM and manager full access lineas" ON public.lineas
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- pagos_sueldos
DROP POLICY IF EXISTS "Owner and manager full access pagos_sueldos" ON public.pagos_sueldos;
CREATE POLICY "Owner GM and manager full access pagos_sueldos" ON public.pagos_sueldos
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- servicios
DROP POLICY IF EXISTS "Owner and manager full access servicios" ON public.servicios;
CREATE POLICY "Owner GM and manager full access servicios" ON public.servicios
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- anulaciones_cierre
DROP POLICY IF EXISTS "Owner and manager can insert anulaciones" ON public.anulaciones_cierre;
CREATE POLICY "Owner GM and manager can insert anulaciones" ON public.anulaciones_cierre
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "Owner and manager can view anulaciones" ON public.anulaciones_cierre;
CREATE POLICY "Owner GM and manager can view anulaciones" ON public.anulaciones_cierre
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- venta
DROP POLICY IF EXISTS "Owner and manager full access org venta" ON public.venta;
CREATE POLICY "Owner GM and manager full access org venta" ON public.venta
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- venta_extra
DROP POLICY IF EXISTS "Owner and manager full access venta_extra" ON public.venta_extra;
CREATE POLICY "Owner GM and manager full access venta_extra" ON public.venta_extra
  FOR ALL TO authenticated
  USING ((venta_id IN (SELECT id FROM venta WHERE organization_id = get_user_organization_id(auth.uid()))) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK ((venta_id IN (SELECT id FROM venta WHERE organization_id = get_user_organization_id(auth.uid()))) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- tareas
DROP POLICY IF EXISTS "Owner/Manager can delete tareas" ON public.tareas;
CREATE POLICY "Owner GM Manager can delete tareas" ON public.tareas
  FOR DELETE TO public
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "Owner/Manager can insert tareas" ON public.tareas;
CREATE POLICY "Owner GM Manager can insert tareas" ON public.tareas
  FOR INSERT TO public
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "Owner/Manager can update tareas" ON public.tareas;
CREATE POLICY "Owner GM Manager can update tareas" ON public.tareas
  FOR UPDATE TO public
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- Manager can view org barberos → also GM
DROP POLICY IF EXISTS "Manager can view org barberos" ON public.barberos;
CREATE POLICY "Manager and GM can view org barberos" ON public.barberos
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));
