DROP VIEW IF EXISTS public.barberos_safe;

CREATE VIEW public.barberos_safe
WITH (security_invoker = off) AS
SELECT
  b.id,
  b.nombre,
  b.apellido,
  b.activo,
  b.organization_id,
  b.sucursal_id,
  b.rol_equipo,
  b.roles_equipo,
  b.created_at,
  b.updated_at
FROM public.barberos b
WHERE
  b.organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_role(auth.uid(), 'general_manager'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND b.sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
    )
    OR (
      public.has_role(auth.uid(), 'barber'::public.app_role)
      AND b.sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
    )
    OR (
      public.is_sucursal_account(auth.uid())
      AND b.sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
    )
  );

GRANT SELECT ON public.barberos_safe TO authenticated;

COMMENT ON VIEW public.barberos_safe IS
  'Safe projection of barberos (no PII, no salary/commission, no PIN). Includes operational roles_equipo for agenda filtering and filters rows by role/sucursal.';