
-- FASE 3.5 — Migración 2: RLS para manager + parche trigger Duda 2

-- INSERT manager: solo tipo='temporal' con fecha_fin obligatoria en sus sucursales
CREATE POLICY "Manager insert temporal barberos_sucursales"
ON public.barberos_sucursales
FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'manager'::app_role)
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  AND tipo = 'temporal'
  AND fecha_fin IS NOT NULL
);

-- DELETE manager: cualquier temporal de sus sucursales
CREATE POLICY "Manager delete temporal barberos_sucursales"
ON public.barberos_sucursales
FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'manager'::app_role)
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  AND tipo = 'temporal'
);

-- Parche Duda 2: extender blacklist a tipo / fecha_inicio / fecha_fin / dias_semana
CREATE OR REPLACE FUNCTION public.bs_enforce_manager_update_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Bypass para service_role / edge functions / cron
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Owner / GM pueden modificar cualquier columna
  IF public.has_role(auth.uid(), 'owner'::app_role)
     OR public.has_role(auth.uid(), 'general_manager'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Resto (manager): bloquear cambios en identidad de la asignación
  IF NEW.barbero_id      <> OLD.barbero_id
     OR NEW.sucursal_id  <> OLD.sucursal_id
     OR NEW.organization_id <> OLD.organization_id THEN
    RAISE EXCEPTION 'Solo owner/general_manager pueden modificar la asignación (barbero/sucursal/organización)';
  END IF;

  -- Bloquear cambios en tipo / fechas / días de la semana (manager solo toca disponible)
  IF NEW.tipo <> OLD.tipo THEN
    RAISE EXCEPTION 'Solo owner/general_manager pueden modificar el tipo de asignación';
  END IF;

  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
     OR NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin
     OR NEW.dias_semana IS DISTINCT FROM OLD.dias_semana THEN
    RAISE EXCEPTION 'Solo owner/general_manager pueden modificar fechas o días de la asignación';
  END IF;

  RETURN NEW;
END;
$function$;
