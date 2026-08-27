-- Extiende estadisticas_ventas_agregadas (aditivo): agrega servicio_id a la CTE `ventas` y una
-- columna nueva `duracion_promedio_ponderada` al final del RETURNS TABLE. Ninguna columna
-- existente cambia de nombre, tipo ni posición — se agrega una sola al final.
-- Postgres no permite CREATE OR REPLACE cuando cambia el conjunto de columnas de un RETURNS
-- TABLE, así que hace falta DROP + CREATE; el contrato para los consumidores existentes
-- (useServiciosClientesData.ts, que lee por nombre de columna vía PostgREST) no cambia.
DROP FUNCTION IF EXISTS public.estadisticas_ventas_agregadas(uuid, uuid, integer);

CREATE FUNCTION public.estadisticas_ventas_agregadas(
  _organization_id uuid,
  _sucursal_id uuid DEFAULT NULL,
  _meses integer DEFAULT 6
)
RETURNS TABLE (
  mes date,
  tickets integer,
  mix jsonb,
  extras_cantidad numeric,
  extras_ingreso numeric,
  tasa_attach_extras numeric,
  por_hora jsonb,
  por_dia_hora jsonb,
  duracion_promedio_ponderada numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH tz_org AS (
    SELECT COALESCE(
             NULLIF((SELECT s.timezone FROM public.sucursales s WHERE s.id = _sucursal_id), ''),
             NULLIF((SELECT o.timezone FROM public.organizations o WHERE o.id = _organization_id), ''),
             'America/Argentina/Buenos_Aires') AS tz
  ), meses AS (
    SELECT generate_series(
             date_trunc('month', (now() AT TIME ZONE (SELECT tz FROM tz_org)))::date - ((GREATEST(_meses,1) - 1) || ' month')::interval,
             date_trunc('month', (now() AT TIME ZONE (SELECT tz FROM tz_org)))::date,
             interval '1 month')::date AS mes
  ), tz AS (
    SELECT s.id AS sucursal_id,
           COALESCE(NULLIF(s.timezone,''), NULLIF(o.timezone,''), 'America/Argentina/Buenos_Aires') AS tz
      FROM public.sucursales s
      JOIN public.organizations o ON o.id = s.organization_id
  ), ventas AS (
    SELECT v.id,
           v.servicio_id,
           date_trunc('month', (v.fecha_hora AT TIME ZONE t.tz))::date AS mes,
           EXTRACT(hour FROM (v.fecha_hora AT TIME ZONE t.tz))::int AS hora,
           EXTRACT(dow  FROM (v.fecha_hora AT TIME ZONE t.tz))::int AS dia,
           COALESCE(NULLIF(v.servicio_nombre, ''), 'Sin especificar') AS servicio,
           COALESCE(v.total_final, 0) AS total_final
      FROM public.venta v
      JOIN tz t ON t.sucursal_id = v.sucursal_id
     WHERE v.organization_id = _organization_id
       AND (_sucursal_id IS NULL OR v.sucursal_id = _sucursal_id)
       AND v.estado = 'activo'
       AND date_trunc('month', (v.fecha_hora AT TIME ZONE t.tz))::date >= (SELECT MIN(mes) FROM meses)
       AND date_trunc('month', (v.fecha_hora AT TIME ZONE t.tz))::date <= (SELECT MAX(mes) FROM meses)
  ), tickets AS (
    SELECT mes, COUNT(*)::int AS tickets FROM ventas GROUP BY mes
  ), mix AS (
    SELECT mes,
           jsonb_agg(jsonb_build_object('servicio', servicio, 'facturacion', facturacion, 'tickets', tickets)
                     ORDER BY facturacion DESC) AS mix
      FROM (
        SELECT mes, servicio, SUM(total_final) AS facturacion, COUNT(*)::int AS tickets
          FROM ventas GROUP BY mes, servicio
      ) s
     GROUP BY mes
  ), horas AS (
    SELECT mes, jsonb_agg(jsonb_build_object('hora', hora, 'tickets', tickets) ORDER BY hora) AS por_hora
      FROM (SELECT mes, hora, COUNT(*)::int AS tickets FROM ventas GROUP BY mes, hora) h
     GROUP BY mes
  ), dia_hora AS (
    SELECT mes, jsonb_agg(jsonb_build_object('dia', dia, 'hora', hora, 'tickets', tickets)) AS por_dia_hora
      FROM (SELECT mes, dia, hora, COUNT(*)::int AS tickets FROM ventas GROUP BY mes, dia, hora) d
     GROUP BY mes
  ), extras AS (
    SELECT v.mes,
           COALESCE(SUM(ve.cantidad), 0) AS extras_cantidad,
           COALESCE(SUM(ve.cantidad * ve.precio_extra), 0) AS extras_ingreso
      FROM ventas v
      JOIN public.venta_extra ve ON ve.venta_id = v.id
     GROUP BY v.mes
  ), servicios AS (
    SELECT vm.mes, SUM(vm.servicios) AS servicios
      FROM public.v_estadisticas_mensuales vm
     WHERE vm.organization_id = _organization_id
       AND (_sucursal_id IS NULL OR vm.sucursal_id = _sucursal_id)
     GROUP BY vm.mes
  ), servicio_dur AS (
    SELECT v.mes, v.servicio_id, COUNT(*)::int AS tickets
      FROM ventas v
     WHERE v.servicio_id IS NOT NULL
     GROUP BY v.mes, v.servicio_id
  ), duracion AS (
    -- Ponderado por volumen real: Σ(tickets_del_servicio × su duración) ÷ Σ(tickets), no un
    -- promedio simple del catálogo. Fallback a 30 min por servicio sin duracion_min cargada —
    -- mismo criterio que useOcupacionResumen.ts usaba en JS (DEFAULT_DURACION_MIN).
    SELECT sd.mes,
           SUM(sd.tickets * COALESCE(NULLIF(s.duracion_min, 0), 30))::numeric / NULLIF(SUM(sd.tickets), 0) AS duracion_promedio_ponderada
      FROM servicio_dur sd
      JOIN public.servicios s ON s.id = sd.servicio_id
     GROUP BY sd.mes
  )
  SELECT m.mes,
         COALESCE(t.tickets, 0),
         COALESCE(x.mix, '[]'::jsonb),
         COALESCE(e.extras_cantidad, 0),
         COALESCE(e.extras_ingreso, 0),
         CASE WHEN COALESCE(sv.servicios, 0) > 0
              THEN (COALESCE(e.extras_cantidad, 0) / sv.servicios) * 100
              ELSE 0 END,
         COALESCE(h.por_hora, '[]'::jsonb),
         COALESCE(dh.por_dia_hora, '[]'::jsonb),
         du.duracion_promedio_ponderada
    FROM meses m
    LEFT JOIN tickets  t  ON t.mes  = m.mes
    LEFT JOIN mix      x  ON x.mes  = m.mes
    LEFT JOIN horas    h  ON h.mes  = m.mes
    LEFT JOIN dia_hora dh ON dh.mes = m.mes
    LEFT JOIN extras   e  ON e.mes  = m.mes
    LEFT JOIN servicios sv ON sv.mes = m.mes
    LEFT JOIN duracion du ON du.mes = m.mes
   ORDER BY m.mes;
$$;

GRANT EXECUTE ON FUNCTION public.estadisticas_ventas_agregadas(uuid, uuid, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.estadisticas_ventas_agregadas IS
  'Ventas agregadas por mes (mix de servicios, tickets, extras, distribución horaria) + duración promedio ponderada por volumen real de ventas (insumo de Ocupación, vía estadisticas_ocupacion_mensual). Extensión aditiva del 16/ago/2026: agrega duracion_promedio_ponderada al final, columnas existentes sin cambios.';
