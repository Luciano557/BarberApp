
-- FASE 3.5 — Migración 3: cron nocturno con timezone por organización

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.bs_recompute_disponibles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r RECORD;
  v_date date;
  v_isodow int;
  v_target_row uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT b.id AS barbero_id, COALESCE(o.timezone, 'America/Argentina/Buenos_Aires') AS tz
    FROM public.barberos_sucursales bs
    JOIN public.barberos b ON b.id = bs.barbero_id
    JOIN public.organizations o ON o.id = bs.organization_id
  LOOP
    v_date   := (now() AT TIME ZONE r.tz)::date;
    v_isodow := EXTRACT(ISODOW FROM v_date)::int;
    v_target_row := NULL;

    -- 1) TEMPORAL vigente (prioridad)
    SELECT id INTO v_target_row
    FROM public.barberos_sucursales
    WHERE barbero_id = r.barbero_id
      AND tipo = 'temporal'
      AND fecha_fin >= v_date
      AND (fecha_inicio IS NULL OR fecha_inicio <= v_date)
    ORDER BY fecha_inicio NULLS LAST, created_at
    LIMIT 1;

    -- 2) RECURRENTE vigente
    IF v_target_row IS NULL THEN
      SELECT id INTO v_target_row
      FROM public.barberos_sucursales
      WHERE barbero_id = r.barbero_id
        AND tipo = 'recurrente'
        AND v_isodow = ANY (dias_semana)
        AND (fecha_inicio IS NULL OR fecha_inicio <= v_date)
        AND (fecha_fin    IS NULL OR fecha_fin    >= v_date)
      ORDER BY created_at
      LIMIT 1;
    END IF;

    -- 3) Fallback: PRINCIPAL
    IF v_target_row IS NULL THEN
      SELECT id INTO v_target_row
      FROM public.barberos_sucursales
      WHERE barbero_id = r.barbero_id
        AND tipo = 'principal'
      LIMIT 1;
    END IF;

    -- 4) Encender la fila objetivo (el trigger apaga las demás del mismo barbero)
    IF v_target_row IS NOT NULL THEN
      UPDATE public.barberos_sucursales
      SET disponible = true
      WHERE id = v_target_row
        AND disponible = false;
    END IF;
  END LOOP;
END;
$function$;

-- Revoke ejecución pública (defensivo, esta función es solo para el cron)
REVOKE ALL ON FUNCTION public.bs_recompute_disponibles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bs_recompute_disponibles() FROM anon, authenticated;

-- Registrar / re-registrar job diario a las 05:00 UTC (02:00 AR)
DO $$
BEGIN
  PERFORM cron.unschedule('bs-recompute-disponibles-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bs-recompute-disponibles-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'bs-recompute-disponibles-daily',
  '0 5 * * *',
  $$ SELECT public.bs_recompute_disponibles(); $$
);
