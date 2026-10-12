-- Etapa 1 (seguridad) · M3 de 3 — organizations.timezone: rechazar valores inválidos al escribir.
-- Authorized exception to the general "DB/RLS go through Lovable" rule, for this build only (see docs/DECISIONES.md).
-- Covers SEG-05 (write path only). A single owner/general manager of ONE organisation can today store a value that
-- makes `AT TIME ZONE` raise inside process_vencimientos_tareas() and bs_recompute_disponibles(), which loop over
-- every organisation: one bad row stops the cron for all of them.
--
-- Scope, on purpose: new writes only. Existing rows are NOT inspected, normalised or corrected, and the cron
-- functions are NOT changed (per-organisation fault isolation belongs to Etapa 2).
-- Accepts NULL (the column is nullable and both cron functions COALESCE it) and any IANA name known to PostgreSQL
-- (pg_timezone_names). POSIX-style strings such as 'UTC+3', abbreviations and empty strings are rejected, and
-- nothing is normalised silently (the match is exact).

CREATE OR REPLACE FUNCTION public.validate_organization_timezone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.timezone IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = NEW.timezone) THEN
    RAISE EXCEPTION 'Zona horaria inválida: %', NEW.timezone
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger functions are never called as RPC; EXECUTE is only needed by whoever creates the trigger.
REVOKE ALL ON FUNCTION public.validate_organization_timezone() FROM PUBLIC, anon, authenticated, service_role;

-- UPDATE OF timezone: updates that do not mention the column (name, phone, billing projection...) are untouched,
-- so organisations that already hold a bad historic value keep working until someone edits that field.
DROP TRIGGER IF EXISTS trg_organizations_validate_timezone ON public.organizations;
CREATE TRIGGER trg_organizations_validate_timezone
BEFORE INSERT OR UPDATE OF timezone ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.validate_organization_timezone();

-- Report (count only, no identifiers) how many historic rows already hold an invalid value; nothing is changed.
DO $report$
DECLARE
  _invalid integer;
BEGIN
  SELECT count(*) INTO _invalid
  FROM public.organizations o
  WHERE o.timezone IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = o.timezone);
  IF _invalid > 0 THEN
    RAISE NOTICE 'M3: % organization(s) already hold an invalid timezone; left untouched (Etapa 2 cleans data).', _invalid;
  END IF;
END
$report$;
