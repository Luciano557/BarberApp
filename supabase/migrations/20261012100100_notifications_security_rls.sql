-- Etapa 1 (seguridad) · M2 de 3 — Notificaciones: RLS, privilegios de tabla e inmutabilidad de entregas.
-- Authorized exception to the general "DB/RLS go through Lovable" rule, for this build only (see docs/DECISIONES.md).
-- Covers SEG-01 and SEG-01b. No rows are modified and no historic migration is edited.
--
-- Model: notification_deliveries is the source of truth. A notification is readable only by a user who holds a
-- delivery of it (same organisation). Every producer already creates one delivery per recipient, filtered by
-- role, sucursal and preference at emission time (see docs/MODULOS/notificaciones.md). Only SECURITY DEFINER
-- producers write notifications/deliveries; clients may read and flip read_at / hidden_at of their own delivery.
-- Depends on M1 (the self-delivery RPCs it removed were the last client write path into deliveries).

-- 1) notifications: SELECT only, and only through an own delivery ----------------------------------------------
DROP POLICY IF EXISTS "select organization notifications" ON public.notifications;
DROP POLICY IF EXISTS "insert organization notifications" ON public.notifications;
DROP POLICY IF EXISTS "update organization notifications" ON public.notifications;

CREATE POLICY "select notifications with own delivery"
ON public.notifications
FOR SELECT TO authenticated
USING (
  organization_id = (SELECT public.get_user_organization_id((SELECT auth.uid())))
  AND EXISTS (
    SELECT 1
    FROM public.notification_deliveries d
    WHERE d.notification_id = notifications.id
      AND d.organization_id = notifications.organization_id
      AND d.user_id = (SELECT auth.uid())
  )
);

REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;

-- 2) notification_deliveries: own SELECT/UPDATE (policies unchanged), no INSERT/DELETE/TRUNCATE ------------------
REVOKE ALL ON TABLE public.notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.notification_deliveries TO authenticated;

-- Only read_at / hidden_at may change. A trigger (SECURITY INVOKER) rather than column privileges, which
-- Supabase documents as an advanced feature that breaks wildcard selects.
CREATE OR REPLACE FUNCTION public.notification_deliveries_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.notification_id IS DISTINCT FROM OLD.notification_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'notification_deliveries: solo read_at y hidden_at pueden modificarse'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger functions are never called as RPC; EXECUTE is only needed by whoever creates the trigger.
REVOKE ALL ON FUNCTION public.notification_deliveries_guard_immutable() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_notification_deliveries_immutable ON public.notification_deliveries;
CREATE TRIGGER trg_notification_deliveries_immutable
BEFORE UPDATE ON public.notification_deliveries
FOR EACH ROW EXECUTE FUNCTION public.notification_deliveries_guard_immutable();

-- 3) Defence in depth for the other two tables: RLS already limits them to authenticated; anon gets no privilege --
REVOKE ALL ON TABLE public.notification_reads FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.user_notification_preferences FROM PUBLIC, anon;

-- 4) Post-conditions: fail (and roll everything back) if the end state is not the intended one --------------------
DO $verify$
DECLARE
  _t text;
  _unexpected text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['notifications', 'notification_deliveries', 'notification_reads', 'user_notification_preferences'] LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || _t)::regclass) THEN
      RAISE EXCEPTION 'M2: row level security is disabled on %', _t;
    END IF;
    IF has_table_privilege('anon', 'public.' || _t, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') THEN
      RAISE EXCEPTION 'M2: anon still has privileges on %', _t;
    END IF;
  END LOOP;

  -- An unknown permissive policy (created by hand or by a tool) would silently defeat the new model.
  SELECT string_agg(policyname, ', ') INTO _unexpected FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname <> 'select notifications with own delivery';
  IF _unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'M2: unexpected policies on notifications: %', _unexpected;
  END IF;

  SELECT string_agg(policyname, ', ') INTO _unexpected FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'notification_deliveries'
    AND policyname NOT IN ('select own deliveries', 'update own deliveries');
  IF _unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'M2: unexpected policies on notification_deliveries: %', _unexpected;
  END IF;

  IF has_table_privilege('authenticated', 'public.notifications', 'INSERT, UPDATE, DELETE, TRUNCATE')
     OR has_table_privilege('authenticated', 'public.notification_deliveries', 'INSERT, DELETE, TRUNCATE') THEN
    RAISE EXCEPTION 'M2: authenticated still holds a write privilege that must be closed';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.notifications', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.notification_deliveries', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.notification_deliveries', 'UPDATE') THEN
    RAISE EXCEPTION 'M2: authenticated lost a privilege the bell needs';
  END IF;
END
$verify$;
