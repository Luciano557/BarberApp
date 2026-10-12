-- Etapa 1 (seguridad) · M1 de 3 — Notificaciones: funciones privilegiadas y permisos EXECUTE.
-- Authorized exception to the general "DB/RLS go through Lovable" rule, for this build only (see docs/DECISIONES.md).
-- Covers SEG-02, SEG-03, SEG-04 and SEG-06. No tables, rows, policies or historic migrations are touched.
--
--   1. Preflight: every function that mentions a _notif_* helper must be SECURITY DEFINER with the SAME owner as the
--      helpers; otherwise revoking EXECUTE would break the triggers/cron that call them, and the migration aborts.
--   2. DROP the two client RPCs without consumers (upsert_notification, upsert_notification_delivery).
--   3. Remove EXECUTE on the internal helpers from PUBLIC, anon, authenticated and service_role. Triggers and the
--      cron keep working because SECURITY DEFINER callers run as the owner, which always retains EXECUTE.
--   4. Close the three client RPCs that nothing emits yet (login, blocked action, PIN authorised).
--   5. Re-create notif_emit_view_event (still SECURITY DEFINER) validating caller, organisation and sucursal.
--   6. process_vencimientos_tareas: remove the Data API exposure (anon/authenticated); cron and service_role keep it.

-- 1) Preflight -------------------------------------------------------------------------------------------------
DO $preflight$
DECLARE
  _helpers constant text[] := ARRAY[
    'public._notif_emit(uuid, text, text, uuid, text, text, uuid, text, text, text, text, jsonb, uuid, text, uuid[], boolean)',
    'public._notif_emit_sensitive(uuid, text, text, uuid, text, text, uuid, text, text, text, jsonb, uuid, uuid[], boolean, text)',
    'public._notif_org_admins(uuid)',
    'public._notif_sucursal_managers(uuid, uuid)',
    'public._notif_sucursal_barbers(uuid, uuid)',
    'public._notif_sucursal_account(uuid, uuid)',
    'public._notif_actor_name(uuid)',
    'public._notif_actor_account_type(uuid)',
    'public._notif_pref_mode(uuid, text, text)',
    'public._notif_turno_dispatch(public.turnos, text, text)',
    'public._notif_turno_metadata(public.turnos)',
    'public._notif_turno_title(public.turnos, text)'
  ];
  _sig text;
  _owner oid;
  _found text;
BEGIN
  FOREACH _sig IN ARRAY _helpers LOOP
    IF to_regprocedure(_sig) IS NULL THEN
      RAISE EXCEPTION 'M1 preflight: expected function % does not exist; the schema differs from the audited one', _sig;
    END IF;
  END LOOP;

  _owner := (SELECT p.proowner FROM pg_proc p WHERE p.oid = to_regprocedure(_helpers[1])::oid);

  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO _found
  FROM unnest(_helpers) s
  JOIN pg_proc p ON p.oid = to_regprocedure(s)::oid
  WHERE p.proowner <> _owner;
  IF _found IS NOT NULL THEN
    RAISE EXCEPTION 'M1 preflight: helpers with a different owner (REVOKE would break their callers): %', _found;
  END IF;

  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO _found
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f' AND NOT p.prosecdef
    AND p.prosrc ~ '_notif_(emit|emit_sensitive|org_admins|sucursal_managers|sucursal_barbers|sucursal_account|actor_name|actor_account_type|pref_mode|turno_dispatch|turno_metadata|turno_title)';
  IF _found IS NOT NULL THEN
    RAISE EXCEPTION 'M1 preflight: SECURITY INVOKER functions call the helpers and would lose access: %', _found;
  END IF;

  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO _found
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f' AND p.proowner <> _owner
    AND p.prosrc ~ '_notif_(emit|emit_sensitive|org_admins|sucursal_managers|sucursal_barbers|sucursal_account|actor_name|actor_account_type|pref_mode|turno_dispatch|turno_metadata|turno_title)';
  IF _found IS NOT NULL THEN
    RAISE EXCEPTION 'M1 preflight: callers with a different owner than the helpers (REVOKE would break them): %', _found;
  END IF;
END
$preflight$;

-- 2) Old client RPCs (no consumer in src/ or supabase/functions/) ----------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_notification(uuid, text, text, text, text, uuid, text, text, timestamptz, jsonb, uuid, text, text, uuid, text, text, uuid, text, timestamptz, boolean);
DROP FUNCTION IF EXISTS public.upsert_notification_delivery(uuid, uuid);

DO $dropped$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
             AND proname IN ('upsert_notification', 'upsert_notification_delivery')) THEN
    RAISE EXCEPTION 'M1: an unexpected overload of upsert_notification / upsert_notification_delivery remains';
  END IF;
END
$dropped$;

-- 3) Internal helpers: nobody calls them from outside the owner's trusted functions ------------------------------
REVOKE ALL ON FUNCTION public._notif_emit(uuid, text, text, uuid, text, text, uuid, text, text, text, text, jsonb, uuid, text, uuid[], boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_emit_sensitive(uuid, text, text, uuid, text, text, uuid, text, text, text, jsonb, uuid, uuid[], boolean, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_org_admins(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_sucursal_managers(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_sucursal_barbers(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_sucursal_account(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_actor_name(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_actor_account_type(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_pref_mode(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_turno_dispatch(public.turnos, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_turno_metadata(public.turnos) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._notif_turno_title(public.turnos, text) FROM PUBLIC, anon, authenticated, service_role;

-- 4) RPCs that nothing emits yet: closed to every role (kept, not dropped; they rely on auth.uid(), so service_role
--    could never use them anyway). A future implementation must grant EXECUTE explicitly.
REVOKE ALL ON FUNCTION public.notif_emit_login_sucursal_account(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notif_emit_action_blocked(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notif_emit_pin_authorized(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- 5) notif_emit_view_event: the only notification RPC a client may call ---------------------------------------
-- Needs SECURITY DEFINER because it writes tables closed to clients (notifications, notification_deliveries).
-- Now validates caller, organisation AND that _sucursal_id belongs to the caller's own sucursal account.
CREATE OR REPLACE FUNCTION public.notif_emit_view_event(
  _module text,                  -- 'gastos' | 'sueldos'
  _sucursal_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _user uuid := auth.uid();
  _org uuid;
  _event text;
  _hour text;
  _key text;
  _recipients uuid[];
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  _org := public.get_user_organization_id(_user);
  IF _org IS NULL THEN RETURN; END IF;
  IF NOT public.has_role(_user, 'sucursal_account'::public.app_role) THEN RETURN; END IF; -- solo cuenta de sucursal
  IF _module IS NULL OR _module NOT IN ('gastos','sueldos') THEN RAISE EXCEPTION 'Módulo inválido'; END IF;
  IF _sucursal_id IS NULL THEN RETURN; END IF;

  -- The sucursal must be the one bound to THIS account, inside THIS account's organisation.
  IF NOT EXISTS (
    SELECT 1 FROM public.sucursal_accounts sa
    WHERE sa.user_id = _user AND sa.organization_id = _org AND sa.sucursal_id = _sucursal_id
  ) THEN
    RETURN;
  END IF;

  _event := CASE _module WHEN 'gastos' THEN 'visualizacion_gastos' ELSE 'visualizacion_sueldos' END;
  _hour := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD-HH24');
  _key := 'visualizacion:' || _module || ':' || _sucursal_id::text || ':' || _user::text || ':' || _hour;

  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(_org) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(_org, _sucursal_id) AS user_id
  ) s;

  PERFORM public._notif_emit_sensitive(
    _org, _event, _key, _sucursal_id,
    'seguridad', 'visualizacion', NULL,
    CASE _module WHEN 'gastos' THEN 'Visualización de gastos' ELSE 'Visualización de sueldos' END,
    'Cuenta de sucursal abrió ' || _module, 'seguridad',
    jsonb_build_object('modulo', _module, 'sucursal_id', _sucursal_id),
    _user, _recipients, true, 'sucursal_account_only'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notif_emit_view_event(text, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.notif_emit_view_event(text, uuid) TO authenticated;

-- 6) Cron entry point: not a Data API function ------------------------------------------------------------------
-- service_role keeps its grant; the pg_cron job runs as the function owner, which always retains EXECUTE.
REVOKE ALL ON FUNCTION public.process_vencimientos_tareas() FROM PUBLIC, anon, authenticated;

-- 7) Post-conditions: fail (and roll everything back) if the end state is not the intended one ---------------------
DO $verify$
DECLARE
  _sig text;
  _job record;
BEGIN
  FOREACH _sig IN ARRAY ARRAY[
    'public._notif_emit(uuid, text, text, uuid, text, text, uuid, text, text, text, text, jsonb, uuid, text, uuid[], boolean)',
    'public._notif_emit_sensitive(uuid, text, text, uuid, text, text, uuid, text, text, text, jsonb, uuid, uuid[], boolean, text)',
    'public._notif_org_admins(uuid)', 'public._notif_sucursal_managers(uuid, uuid)', 'public._notif_sucursal_barbers(uuid, uuid)',
    'public._notif_sucursal_account(uuid, uuid)', 'public._notif_actor_name(uuid)', 'public._notif_actor_account_type(uuid)',
    'public._notif_pref_mode(uuid, text, text)', 'public._notif_turno_dispatch(public.turnos, text, text)',
    'public._notif_turno_metadata(public.turnos)', 'public._notif_turno_title(public.turnos, text)'
  ] LOOP
    IF has_function_privilege('anon', to_regprocedure(_sig), 'EXECUTE')
       OR has_function_privilege('authenticated', to_regprocedure(_sig), 'EXECUTE')
       OR has_function_privilege('service_role', to_regprocedure(_sig), 'EXECUTE') THEN
      RAISE EXCEPTION 'M1: % is still executable by a client role', _sig;
    END IF;
  END LOOP;

  FOREACH _sig IN ARRAY ARRAY[
    'public.notif_emit_login_sucursal_account(uuid)', 'public.notif_emit_action_blocked(text, uuid)',
    'public.notif_emit_pin_authorized(text, uuid, uuid, text)'
  ] LOOP
    IF has_function_privilege('anon', to_regprocedure(_sig), 'EXECUTE')
       OR has_function_privilege('authenticated', to_regprocedure(_sig), 'EXECUTE')
       OR has_function_privilege('service_role', to_regprocedure(_sig), 'EXECUTE') THEN
      RAISE EXCEPTION 'M1: % is still executable by a client role', _sig;
    END IF;
  END LOOP;

  IF has_function_privilege('anon', to_regprocedure('public.process_vencimientos_tareas()'), 'EXECUTE')
     OR has_function_privilege('authenticated', to_regprocedure('public.process_vencimientos_tareas()'), 'EXECUTE') THEN
    RAISE EXCEPTION 'M1: process_vencimientos_tareas() is still executable by anon/authenticated';
  END IF;

  IF NOT has_function_privilege('authenticated', to_regprocedure('public.notif_emit_view_event(text, uuid)'), 'EXECUTE')
     OR has_function_privilege('anon', to_regprocedure('public.notif_emit_view_event(text, uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'M1: notif_emit_view_event must be executable by authenticated only';
  END IF;

  -- Every pg_cron job that runs the vencimientos process must still be able to execute it.
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR _job IN EXECUTE 'SELECT jobname, username FROM cron.job WHERE command ILIKE ''%process_vencimientos_tareas%''' LOOP
      IF NOT has_function_privilege(_job.username, 'public.process_vencimientos_tareas()', 'EXECUTE') THEN
        RAISE EXCEPTION 'M1: pg_cron job "%" runs as "%" which would lose EXECUTE on process_vencimientos_tareas()', _job.jobname, _job.username;
      END IF;
    END LOOP;
  END IF;
END
$verify$;
