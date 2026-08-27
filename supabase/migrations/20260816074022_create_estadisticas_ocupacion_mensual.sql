-- Tasa de Ocupación mensual, resuelta 100% en base (Etapa 1 aplicada a Ocupación):
-- horas vendidas ÷ horas-silla disponibles del horario general × barberos con rol 'barber'.
-- NULL explícito (nunca 0 forzado) cuando falta horario general, no hay barberos con rol
-- 'barber', o no hay ventas con servicio matcheado ese mes — el frontend decide qué mostrar
-- según ese NULL, no lo calcula.
CREATE OR REPLACE FUNCTION public.estadisticas_ocupacion_mensual(
  _organization_id uuid,
  _sucursal_id uuid DEFAULT NULL,
  _meses integer DEFAULT 6
)
RETURNS TABLE (
  mes date,
  tasa_ocupacion numeric,
  tasa_ocupacion_parcial numeric,
  cobertura_incompleta boolean,
  duracion_promedio_ponderada numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH tz AS (
    SELECT COALESCE(
             NULLIF((SELECT s.timezone FROM public.sucursales s WHERE s.id = _sucursal_id), ''),
             NULLIF((SELECT o.timezone FROM public.organizations o WHERE o.id = _organization_id), ''),
             'America/Argentina/Buenos_Aires') AS tz
  ), hoy AS (
    SELECT (now() AT TIME ZONE (SELECT tz FROM tz)) AS ahora
  ), meses AS (
    SELECT generate_series(
             date_trunc('month', (SELECT ahora FROM hoy))::date - ((GREATEST(_meses,1) - 1) || ' month')::interval,
             date_trunc('month', (SELECT ahora FROM hoy))::date,
             interval '1 month')::date AS mes
  ), horarios_generales AS (
    -- Solo horario GENERAL de la sucursal (barbero_id IS NULL) — no mira horario individual
    -- ni bloqueos puntuales. Mismo criterio que useOcupacionResumen.ts usaba en JS.
    SELECT h.dia_semana, h.hora_inicio, h.hora_fin
      FROM public.horarios_trabajo h
     WHERE h.organization_id = _organization_id
       AND h.activo = true
       AND h.barbero_id IS NULL
       AND (_sucursal_id IS NULL OR h.sucursal_id = _sucursal_id)
  ), cobertura AS (
    SELECT (COUNT(*) = 0) AS cobertura_incompleta FROM horarios_generales
  ), horas_por_dia AS (
    SELECT dia_semana,
           SUM(GREATEST(0, EXTRACT(epoch FROM (hora_fin - hora_inicio)) / 3600.0)) AS horas
      FROM horarios_generales
     GROUP BY dia_semana
  ), barberos_rol AS (
    -- Barberos ACTIVOS con rol 'barber' hoy — no reconstruye histórico de equipo por mes
    -- pasado (límite ya aceptado, no forma parte de este cambio).
    SELECT COUNT(*) AS cant
      FROM public.barberos b
     WHERE b.organization_id = _organization_id
       AND b.activo = true
       AND (_sucursal_id IS NULL OR b.sucursal_id = _sucursal_id)
       AND b.roles_equipo @> ARRAY['barber']::text[]
  ), bounds AS (
    SELECT m.mes AS mes,
           m.mes AS inicio,
           (m.mes + interval '1 month' - interval '1 day')::date AS fin_mes,
           (m.mes = date_trunc('month', (SELECT ahora FROM hoy))::date) AS es_mes_actual
      FROM meses m
  ), rango_efectivo AS (
    -- Mes en curso: solo hasta hoy (mismo recorte que el resto del panel). Meses pasados: completos.
    SELECT mes, inicio,
           CASE WHEN es_mes_actual THEN LEAST(fin_mes, (SELECT ahora FROM hoy)::date) ELSE fin_mes END AS fin_efectivo
      FROM bounds
  ), horas_disponibles AS (
    SELECT re.mes,
           COALESCE(SUM(hpd.horas), 0) AS horas_apertura_rango
      FROM rango_efectivo re
      JOIN LATERAL generate_series(re.inicio, re.fin_efectivo, interval '1 day') AS d(dia) ON true
      LEFT JOIN horas_por_dia hpd ON hpd.dia_semana = EXTRACT(isodow FROM d.dia)::int
     GROUP BY re.mes
  ), mes_actual AS (
    SELECT mes FROM bounds WHERE es_mes_actual
  ), mes_anterior_parcial AS (
    -- Solo el mes inmediatamente anterior al actual necesita el recorte "mismos primeros N
    -- días" — mismo patrón parcial_* que ya usa estadisticas_mensuales.
    SELECT b.mes,
           b.inicio,
           LEAST(EXTRACT(day FROM (SELECT ahora FROM hoy))::int, EXTRACT(day FROM b.fin_mes)::int) AS dia_corte
      FROM bounds b
     WHERE b.mes = (SELECT mes FROM mes_actual) - interval '1 month'
  ), horas_disponibles_parcial AS (
    SELECT map.mes,
           COALESCE(SUM(hpd.horas), 0) AS horas_apertura_rango
      FROM mes_anterior_parcial map
      JOIN LATERAL generate_series(map.inicio, (map.inicio + (map.dia_corte - 1))::date, interval '1 day') AS d(dia) ON true
      LEFT JOIN horas_por_dia hpd ON hpd.dia_semana = EXTRACT(isodow FROM d.dia)::int
     GROUP BY map.mes
  ), servicios_mes AS (
    -- Servicios del mes: SIEMPRE de v_estadisticas_mensuales (misma fuente que el resto del
    -- panel, basada en `ingresos`) — nunca de venta/estadisticas_ventas_agregadas, para no
    -- reintroducir la doble fuente de verdad venta/ingresos.
    SELECT vm.mes, SUM(vm.servicios) AS servicios, SUM(vm.parcial_servicios) AS parcial_servicios
      FROM public.v_estadisticas_mensuales vm
     WHERE vm.organization_id = _organization_id
       AND (_sucursal_id IS NULL OR vm.sucursal_id = _sucursal_id)
     GROUP BY vm.mes
  ), duracion AS (
    -- Composición de agregador sobre agregador (mismo patrón que estadisticas_mensuales ya usa
    -- con fin_*): reusa la duración ponderada por volumen ya resuelta en estadisticas_ventas_agregadas,
    -- no duplica su join venta.servicio_id → servicios.duracion_min.
    SELECT mes, duracion_promedio_ponderada
      FROM public.estadisticas_ventas_agregadas(_organization_id, _sucursal_id, _meses)
  )
  SELECT
    m.mes,
    CASE WHEN COALESCE(c.cobertura_incompleta, true)
           OR COALESCE(hd.horas_apertura_rango, 0) <= 0
           OR (SELECT cant FROM barberos_rol) <= 0
           OR du.duracion_promedio_ponderada IS NULL
         THEN NULL
         ELSE ((COALESCE(sm.servicios, 0) * du.duracion_promedio_ponderada / 60.0)
               / (hd.horas_apertura_rango * (SELECT cant FROM barberos_rol))) * 100
    END AS tasa_ocupacion,
    CASE WHEN hdp.mes IS NULL THEN NULL
         WHEN COALESCE(c.cobertura_incompleta, true)
           OR COALESCE(hdp.horas_apertura_rango, 0) <= 0
           OR (SELECT cant FROM barberos_rol) <= 0
           OR du.duracion_promedio_ponderada IS NULL
         THEN NULL
         ELSE ((COALESCE(sm.parcial_servicios, 0) * du.duracion_promedio_ponderada / 60.0)
               / (hdp.horas_apertura_rango * (SELECT cant FROM barberos_rol))) * 100
    END AS tasa_ocupacion_parcial,
    COALESCE(c.cobertura_incompleta, true) AS cobertura_incompleta,
    du.duracion_promedio_ponderada
  FROM meses m
  LEFT JOIN horas_disponibles hd ON hd.mes = m.mes
  LEFT JOIN horas_disponibles_parcial hdp ON hdp.mes = m.mes
  LEFT JOIN servicios_mes sm ON sm.mes = m.mes
  LEFT JOIN duracion du ON du.mes = m.mes
  CROSS JOIN cobertura c
  ORDER BY m.mes;
$$;

GRANT EXECUTE ON FUNCTION public.estadisticas_ocupacion_mensual(uuid, uuid, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.estadisticas_ocupacion_mensual IS
  'Tasa de Ocupación mensual ya calculada en base: horas vendidas (servicios de v_estadisticas_mensuales × duración ponderada por volumen real) ÷ horas-silla disponibles (horario general × barberos con rol barbero). NULL explícito, nunca 0 forzado, cuando falta horario general, no hay barberos con rol barbero, o no hay ventas con servicio matcheado ese mes.';
