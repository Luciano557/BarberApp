COMMENT ON FUNCTION public.generar_resumenes_mensuales(date) IS
'LIMITACIÓN CONOCIDA (zona horaria multi-país): usa COALESCE(sucursal.timezone, organizacion.timezone, ''America/Argentina/Buenos_Aires''). Hoy (ago-2026) todos los clientes operan en Argentina, sin impacto real. SI SE SUMAN CLIENTES DE OTROS PAÍSES: confirmar primero si el campo de país completado al registrar la cuenta alimenta un timezone real o es solo informativo. Si no está conectado, esta función seguirá usando Buenos Aires por defecto SIN avisar, generando desfasajes silenciosos en el mes/día asignado a ventas cerca del cierre, especialmente en países con más de una zona horaria (Brasil, México). No asumir que país y timezone son lo mismo. Pendiente sin resolver, no auditado si el campo de país existe en el schema (ago-2026).';

CREATE OR REPLACE FUNCTION public._test_cron_error_capture()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_msg text;
  v_detail text;
BEGIN
  RAISE EXCEPTION 'prueba controlada' USING DETAIL = 'detalle de prueba controlada';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS
    v_msg = MESSAGE_TEXT,
    v_detail = PG_EXCEPTION_DETAIL;
  INSERT INTO public.cron_job_errors (job_name, error_message, error_detail, contexto)
  VALUES (
    '_test_cron_error_capture',
    coalesce(v_msg, 'error desconocido'),
    coalesce(nullif(v_detail, ''), SQLSTATE),
    jsonb_build_object('target_mes', NULL, 'sqlstate', SQLSTATE)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public._test_cron_error_capture() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._test_cron_error_capture() FROM anon;
REVOKE ALL ON FUNCTION public._test_cron_error_capture() FROM authenticated;