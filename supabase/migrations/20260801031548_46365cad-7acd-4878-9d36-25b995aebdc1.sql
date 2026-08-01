-- 1) Tabla de errores de procesos programados (no existía nada reusable:
-- access_logs es de accesos de usuarios y mp_webhook_log es específico de Mercado Pago)
CREATE TABLE IF NOT EXISTS public.cron_job_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name text NOT NULL,
  error_message text NOT NULL,
  error_detail text,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cron_job_errors TO service_role;

ALTER TABLE public.cron_job_errors ENABLE ROW LEVEL SECURITY;

-- Sin políticas para anon/authenticated: tabla interna de diagnóstico del sistema.

COMMENT ON TABLE public.cron_job_errors IS 'Registro de errores de procesos programados (pg_cron). Solo escritura/lectura por service_role.';

CREATE INDEX IF NOT EXISTS idx_cron_job_errors_job_created
  ON public.cron_job_errors (job_name, created_at DESC);

-- 2) Wrapper con manejo de excepción
CREATE OR REPLACE FUNCTION public.generar_resumenes_mensuales_job(target_mes date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_msg text;
  v_detail text;
BEGIN
  PERFORM public.generar_resumenes_mensuales(target_mes);
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS
    v_msg = MESSAGE_TEXT,
    v_detail = PG_EXCEPTION_DETAIL;
  INSERT INTO public.cron_job_errors (job_name, error_message, error_detail, contexto)
  VALUES (
    'generar-resumenes-mensuales',
    coalesce(v_msg, 'error desconocido'),
    coalesce(nullif(v_detail, ''), SQLSTATE),
    jsonb_build_object('target_mes', target_mes, 'sqlstate', SQLSTATE)
  );
END;
$fn$;

COMMENT ON FUNCTION public.generar_resumenes_mensuales_job(date) IS
  'Envoltorio de generar_resumenes_mensuales() usado por el job pg_cron generar-resumenes-mensuales. Captura cualquier error y lo registra en public.cron_job_errors para evitar fallos silenciosos.';

REVOKE ALL ON FUNCTION public.generar_resumenes_mensuales_job(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generar_resumenes_mensuales_job(date) FROM authenticated;
REVOKE ALL ON FUNCTION public.generar_resumenes_mensuales_job(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.generar_resumenes_mensuales_job(date) TO service_role;

-- 3) Job pg_cron: día 5 de cada mes, 05:00 UTC
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generar-resumenes-mensuales') THEN
    PERFORM cron.unschedule('generar-resumenes-mensuales');
  END IF;

  PERFORM cron.schedule(
    'generar-resumenes-mensuales',
    '0 5 5 * *',
    $cmd$ SELECT public.generar_resumenes_mensuales_job(); $cmd$
  );
END;
$do$;