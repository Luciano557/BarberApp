-- Four referral levels explicitly requested by the program owner.
-- Direct DB exception continues the authorized Aliados rollout; no Auth/RLS changes.
-- Preserve accepted terms, agreements, quotes and financial snapshots already fixed.
DO $upgrade$
DECLARE _definition text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='partner_program_command' AND NOT p.prosecdef
      AND md5(p.prosrc)='4e8cff738a6737dad22f6cf80abd0305')
    OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='partner_rate' AND NOT p.prosecdef
      AND md5(p.prosrc)='212fa1fec0447bc2443e44ffe786418a') THEN
    RAISE EXCEPTION 'PARTNER_FOUR_LEVELS_SOURCE_DRIFT';
  END IF;
  -- Exact source guarded above: only new enrollments and unfrozen quote defaults
  -- adopt v3. Existing percent_snapshot/snapshot_terms and quote reuse stay intact.
  SELECT pg_get_functiondef('public.partner_program_command(integer,text,uuid,jsonb)'::regprocedure)
    INTO _definition;
  EXECUTE replace(_definition,'2026-10-14-v2','2026-11-05-v3');
END $upgrade$;

CREATE OR REPLACE FUNCTION public.partner_rate(_partner_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $function$
  SELECT coalesce((SELECT percent FROM partner_agreements WHERE partner_id=_partner_id AND NOT suspended
    AND starts_at<=now() AND ends_at>now() ORDER BY starts_at DESC LIMIT 1),
    (SELECT CASE WHEN count(*)>=20 THEN 80 WHEN count(*)>=10 THEN 50
      WHEN count(*)>=5 THEN 30 ELSE 10 END
      FROM partner_referrals WHERE partner_id=_partner_id AND qualified));
$function$;

UPDATE public.partner_program_config SET terms_version='2026-11-05-v3' WHERE singleton;
REVOKE ALL ON FUNCTION public.partner_rate(uuid),public.partner_program_command(integer,text,uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.partner_rate(uuid),public.partner_program_command(integer,text,uuid,jsonb)
  TO service_role;
