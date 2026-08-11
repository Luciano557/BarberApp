-- =====================================================================================
-- Estadísticas: cálculo agregado en base de datos (Capa 1 fórmulas + Capa 2 agregados)
--
-- CONVENCIONES A RESPETAR EN ADELANTE (documentar también en AGENTS.md):
--  1. Toda fórmula financiera nueva se define como función SQL con prefijo `fin_`.
--     Nunca suelta dentro de otra función, vista o componente.
--  2. Todo agregado mensual de facturación, servicios o costos sale de
--     `public.v_estadisticas_mensuales`. No se arma un SUM nuevo sobre `ingresos`
--     o `Egresos` para esto.
--  3. El frontend no calcula métricas financieras: las consume ya resueltas. Única
--     excepción: formateo visual (moneda, redondeo de presentación, estimación del mes
--     en curso por días transcurridos) — nunca redefinir una fórmula financiera ahí.
--
-- Corte de fecha único: >= inicio_mes AND < inicio_mes_siguiente, con AT TIME ZONE de la
-- sucursal (respaldo: organización, respaldo final: America/Argentina/Buenos_Aires).
-- =====================================================================================

-- ---------- CAPA 1: fórmulas puras (IMMUTABLE) ----------

CREATE OR REPLACE FUNCTION public.fin_rentabilidad_pct(_facturacion numeric, _egresos numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(_facturacion, 0) > 0
              THEN ((COALESCE(_facturacion,0) - COALESCE(_egresos,0)) / _facturacion) * 100
              ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.fin_ticket_promedio(_facturacion numeric, _servicios numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(_servicios, 0) > 0
              THEN COALESCE(_facturacion,0) / _servicios ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.fin_costo_fijo_por_servicio(_costos_fijos numeric, _servicios numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(_servicios, 0) > 0
              THEN COALESCE(_costos_fijos,0) / _servicios ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.fin_costo_variable_por_servicio(_costos_variables numeric, _servicios numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(_servicios, 0) > 0
              THEN COALESCE(_costos_variables,0) / _servicios ELSE 0 END;
$$;

-- Equivale a ticket_promedio - costo_fijo_por_servicio - costo_variable_por_servicio
-- cuando _costos_totales = costos fijos + costos variables (mismo criterio que el frontend).
CREATE OR REPLACE FUNCTION public.fin_ganancia_por_servicio(_facturacion numeric, _costos_totales numeric, _servicios numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(_servicios, 0) > 0
              THEN (COALESCE(_facturacion,0) - COALESCE(_costos_totales,0)) / _servicios
              ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.fin_punto_equilibrio(_costos_fijos numeric, _ganancia_por_servicio numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(_ganancia_por_servicio, 0) > 0
              THEN CEIL(COALESCE(_costos_fijos,0) / _ganancia_por_servicio)
              ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.fin_costo_laboral_pct(_sueldos numeric, _comision_productos numeric, _facturacion numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(_facturacion, 0) > 0
              THEN ((COALESCE(_sueldos,0) + COALESCE(_comision_productos,0)) / _facturacion) * 100
              ELSE 0 END;
$$;

-- Espejo exacto de calcVariation() del frontend: NULL cuando no hay base de comparación
-- (anterior = 0 y actual <> 0), 0 cuando ambos son 0. No es una métrica financiera de
-- división por cero: NULL acá significa "no comparable", y así lo renderiza la UI.
CREATE OR REPLACE FUNCTION public.fin_variacion_pct(_actual numeric, _anterior numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
           WHEN COALESCE(_anterior, 0) = 0 THEN CASE WHEN COALESCE(_actual,0) = 0 THEN 0 ELSE NULL END
           ELSE ((COALESCE(_actual,0) - _anterior) / ABS(_anterior)) * 100
         END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_rentabilidad_pct(numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_ticket_promedio(numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_costo_fijo_por_servicio(numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_costo_variable_por_servicio(numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_ganancia_por_servicio(numeric, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_punto_equilibrio(numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_costo_laboral_pct(numeric, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_variacion_pct(numeric, numeric) TO authenticated, service_role;

-- ---------- CAPA 2: agregados ----------

CREATE OR REPLACE VIEW public.v_estadisticas_mensuales
WITH (security_invoker = on) AS
WITH tz AS (
  SELECT s.id AS sucursal_id,
         s.organization_id,
         COALESCE(NULLIF(s.timezone,''), NULLIF(o.timezone,''), 'America/Argentina/Buenos_Aires') AS tz
    FROM public.sucursales s
    JOIN public.organizations o ON o.id = s.organization_id
), ing AS (
  SELECT i.organization_id,
         i.sucursal_id,
         date_trunc('month', (i.created_at AT TIME ZONE t.tz))::date AS mes,
         COALESCE(SUM(i.total_facturado), 0)      AS facturacion,
         COALESCE(SUM(i.cantidad_de_servicios),0) AS servicios,
         COALESCE(SUM(i.efectivo), 0)             AS efectivo,
         COALESCE(SUM(i.mp), 0)                   AS mp,
         COALESCE(SUM(i.recargos_total), 0)       AS recargos_total,
         COALESCE(SUM(i.perdida), 0)              AS perdida,
         COALESCE(SUM(i.sueldo), 0)               AS sueldo_total,
         COALESCE(SUM(i.comision_productos), 0)   AS comision_productos,
         COUNT(DISTINCT i.barbero_id)             AS barberos_del_mes,
         COALESCE(SUM(i.total_facturado) FILTER (WHERE EXTRACT(day FROM (i.created_at AT TIME ZONE t.tz)) <= EXTRACT(day FROM (now() AT TIME ZONE t.tz))), 0) AS parcial_facturacion,
         COALESCE(SUM(i.cantidad_de_servicios) FILTER (WHERE EXTRACT(day FROM (i.created_at AT TIME ZONE t.tz)) <= EXTRACT(day FROM (now() AT TIME ZONE t.tz))), 0) AS parcial_servicios,
         COALESCE(SUM(i.efectivo) FILTER (WHERE EXTRACT(day FROM (i.created_at AT TIME ZONE t.tz)) <= EXTRACT(day FROM (now() AT TIME ZONE t.tz))), 0) AS parcial_efectivo,
         COALESCE(SUM(i.mp) FILTER (WHERE EXTRACT(day FROM (i.created_at AT TIME ZONE t.tz)) <= EXTRACT(day FROM (now() AT TIME ZONE t.tz))), 0) AS parcial_mp,
         COALESCE(SUM(i.recargos_total) FILTER (WHERE EXTRACT(day FROM (i.created_at AT TIME ZONE t.tz)) <= EXTRACT(day FROM (now() AT TIME ZONE t.tz))), 0) AS parcial_recargos_total,
         COALESCE(SUM(i.perdida) FILTER (WHERE EXTRACT(day FROM (i.created_at AT TIME ZONE t.tz)) <= EXTRACT(day FROM (now() AT TIME ZONE t.tz))), 0) AS parcial_perdida,
         COUNT(DISTINCT i.barbero_id) FILTER (WHERE EXTRACT(day FROM (i.created_at AT TIME ZONE t.tz)) <= EXTRACT(day FROM (now() AT TIME ZONE t.tz))) AS parcial_barberos_del_mes
    FROM public.ingresos i
    JOIN tz t ON t.sucursal_id = i.sucursal_id
   WHERE i.estado IS DISTINCT FROM 'eliminado'
   GROUP BY 1, 2, 3
), egr AS (
  SELECT e.organization_id,
         e.sucursal_id,
         date_trunc('month', (e."Fecha" AT TIME ZONE t.tz))::date AS mes,
         COALESCE(SUM(e."Monto") FILTER (WHERE e.tipo_costo = 'fijo'), 0)         AS costos_fijos,
         COALESCE(SUM(e."Monto") FILTER (WHERE e.tipo_costo = 'variable'), 0)     AS costos_variables,
         COALESCE(SUM(e."Monto") FILTER (WHERE e.tipo_costo = 'semivariable'), 0) AS costos_semivariables,
         COALESCE(SUM(e."Monto") FILTER (WHERE e.tipo_costo = 'fijo' AND EXTRACT(day FROM (e."Fecha" AT TIME ZONE t.tz)) <= EXTRACT(day FROM (now() AT TIME ZONE t.tz))), 0) AS parcial_costos_fijos
    FROM public."Egresos" e
    JOIN tz t ON t.sucursal_id = e.sucursal_id
   WHERE e.estado = 'activo'
     AND e.tipo_costo IN ('fijo','variable','semivariable')
   GROUP BY 1, 2, 3
)
SELECT
  COALESCE(i.organization_id, g.organization_id) AS organization_id,
  COALESCE(i.sucursal_id, g.sucursal_id)         AS sucursal_id,
  COALESCE(i.mes, g.mes)                         AS mes,
  COALESCE(i.facturacion, 0)                     AS facturacion,
  COALESCE(i.servicios, 0)                       AS servicios,
  COALESCE(i.efectivo, 0)                        AS efectivo,
  COALESCE(i.mp, 0)                              AS mp,
  COALESCE(i.recargos_total, 0)                  AS recargos_total,
  COALESCE(i.perdida, 0)                         AS perdida,
  COALESCE(i.sueldo_total, 0)                    AS sueldo_total,
  COALESCE(i.comision_productos, 0)              AS comision_productos,
  COALESCE(i.barberos_del_mes, 0)                AS barberos_del_mes,
  COALESCE(g.costos_fijos, 0)                    AS costos_fijos,
  COALESCE(g.costos_variables, 0)                AS costos_variables,
  COALESCE(g.costos_semivariables, 0)            AS costos_semivariables,
  COALESCE(g.costos_fijos, 0) + COALESCE(g.costos_variables, 0) + COALESCE(g.costos_semivariables, 0) AS total_egresos,
  COALESCE(i.parcial_facturacion, 0)             AS parcial_facturacion,
  COALESCE(i.parcial_servicios, 0)               AS parcial_servicios,
  COALESCE(i.parcial_efectivo, 0)                AS parcial_efectivo,
  COALESCE(i.parcial_mp, 0)                      AS parcial_mp,
  COALESCE(i.parcial_recargos_total, 0)          AS parcial_recargos_total,
  COALESCE(i.parcial_perdida, 0)                 AS parcial_perdida,
  COALESCE(i.parcial_barberos_del_mes, 0)        AS parcial_barberos_del_mes,
  COALESCE(g.parcial_costos_fijos, 0)            AS parcial_costos_fijos
FROM ing i
FULL OUTER JOIN egr g
  ON g.organization_id = i.organization_id
 AND g.sucursal_id = i.sucursal_id
 AND g.mes = i.mes;

GRANT SELECT ON public.v_estadisticas_mensuales TO authenticated, service_role;

COMMENT ON VIEW public.v_estadisticas_mensuales IS
  'Agregados mensuales de facturación, servicios y costos por organización/sucursal/mes, con corte de mes resuelto en el huso horario de la sucursal. Fuente única para Estadísticas: no armar SUM nuevos sobre ingresos/Egresos para esto.';

-- Métricas mensuales de Estadísticas. SECURITY INVOKER: respeta RLS tal cual.
CREATE OR REPLACE FUNCTION public.estadisticas_mensuales(
  _organization_id uuid,
  _sucursal_id uuid DEFAULT NULL,
  _meses integer DEFAULT 6
)
RETURNS TABLE (
  mes date,
  facturacion numeric,
  servicios numeric,
  efectivo numeric,
  mp numeric,
  recargos_total numeric,
  perdida numeric,
  sueldo_total numeric,
  comision_productos numeric,
  barberos_del_mes integer,
  costos_fijos numeric,
  costos_variables numeric,
  costos_semivariables numeric,
  total_egresos numeric,
  parcial_facturacion numeric,
  parcial_servicios numeric,
  parcial_efectivo numeric,
  parcial_mp numeric,
  parcial_recargos_total numeric,
  parcial_perdida numeric,
  parcial_barberos_del_mes integer,
  parcial_costos_fijos numeric,
  ticket_promedio numeric,
  rentabilidad_pct numeric,
  costo_fijo_por_servicio numeric,
  costo_variable_por_servicio numeric,
  ganancia_por_servicio numeric,
  punto_equilibrio numeric,
  costo_laboral_pct numeric
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
  ), meses AS (
    SELECT generate_series(
             date_trunc('month', (now() AT TIME ZONE (SELECT tz FROM tz)))::date - ((GREATEST(_meses,1) - 1) || ' month')::interval,
             date_trunc('month', (now() AT TIME ZONE (SELECT tz FROM tz)))::date,
             interval '1 month')::date AS mes
  ), base AS (
    SELECT v.mes,
           SUM(v.facturacion) AS facturacion,
           SUM(v.servicios) AS servicios,
           SUM(v.efectivo) AS efectivo,
           SUM(v.mp) AS mp,
           SUM(v.recargos_total) AS recargos_total,
           SUM(v.perdida) AS perdida,
           SUM(v.sueldo_total) AS sueldo_total,
           SUM(v.comision_productos) AS comision_productos,
           SUM(v.barberos_del_mes) AS barberos_del_mes,
           SUM(v.costos_fijos) AS costos_fijos,
           SUM(v.costos_variables) AS costos_variables,
           SUM(v.costos_semivariables) AS costos_semivariables,
           SUM(v.total_egresos) AS total_egresos,
           SUM(v.parcial_facturacion) AS parcial_facturacion,
           SUM(v.parcial_servicios) AS parcial_servicios,
           SUM(v.parcial_efectivo) AS parcial_efectivo,
           SUM(v.parcial_mp) AS parcial_mp,
           SUM(v.parcial_recargos_total) AS parcial_recargos_total,
           SUM(v.parcial_perdida) AS parcial_perdida,
           SUM(v.parcial_barberos_del_mes) AS parcial_barberos_del_mes,
           SUM(v.parcial_costos_fijos) AS parcial_costos_fijos
      FROM public.v_estadisticas_mensuales v
     WHERE v.organization_id = _organization_id
       AND (_sucursal_id IS NULL OR v.sucursal_id = _sucursal_id)
     GROUP BY v.mes
  )
  SELECT m.mes,
         COALESCE(b.facturacion, 0),
         COALESCE(b.servicios, 0),
         COALESCE(b.efectivo, 0),
         COALESCE(b.mp, 0),
         COALESCE(b.recargos_total, 0),
         COALESCE(b.perdida, 0),
         COALESCE(b.sueldo_total, 0),
         COALESCE(b.comision_productos, 0),
         COALESCE(b.barberos_del_mes, 0)::integer,
         COALESCE(b.costos_fijos, 0),
         COALESCE(b.costos_variables, 0),
         COALESCE(b.costos_semivariables, 0),
         COALESCE(b.total_egresos, 0),
         COALESCE(b.parcial_facturacion, 0),
         COALESCE(b.parcial_servicios, 0),
         COALESCE(b.parcial_efectivo, 0),
         COALESCE(b.parcial_mp, 0),
         COALESCE(b.parcial_recargos_total, 0),
         COALESCE(b.parcial_perdida, 0),
         COALESCE(b.parcial_barberos_del_mes, 0)::integer,
         COALESCE(b.parcial_costos_fijos, 0),
         public.fin_ticket_promedio(COALESCE(b.facturacion,0), COALESCE(b.servicios,0)),
         public.fin_rentabilidad_pct(COALESCE(b.facturacion,0), COALESCE(b.total_egresos,0)),
         public.fin_costo_fijo_por_servicio(COALESCE(b.costos_fijos,0), COALESCE(b.servicios,0)),
         public.fin_costo_variable_por_servicio(COALESCE(b.costos_variables,0), COALESCE(b.servicios,0)),
         public.fin_ganancia_por_servicio(COALESCE(b.facturacion,0), COALESCE(b.costos_fijos,0) + COALESCE(b.costos_variables,0), COALESCE(b.servicios,0)),
         public.fin_punto_equilibrio(
           COALESCE(b.costos_fijos,0),
           public.fin_ganancia_por_servicio(COALESCE(b.facturacion,0), COALESCE(b.costos_fijos,0) + COALESCE(b.costos_variables,0), COALESCE(b.servicios,0))),
         public.fin_costo_laboral_pct(COALESCE(b.sueldo_total,0), COALESCE(b.comision_productos,0), COALESCE(b.facturacion,0))
    FROM meses m
    LEFT JOIN base b ON b.mes = m.mes
   ORDER BY m.mes;
$$;

GRANT EXECUTE ON FUNCTION public.estadisticas_mensuales(uuid, uuid, integer) TO authenticated, service_role;

-- Ventas agregadas: mix de servicios, attach de extras y distribución por hora / día-hora.
-- Reemplaza el fetch crudo de `venta` en el frontend (que truncaba a 1000 filas).
CREATE OR REPLACE FUNCTION public.estadisticas_ventas_agregadas(
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
  por_dia_hora jsonb
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
         COALESCE(dh.por_dia_hora, '[]'::jsonb)
    FROM meses m
    LEFT JOIN tickets  t  ON t.mes  = m.mes
    LEFT JOIN mix      x  ON x.mes  = m.mes
    LEFT JOIN horas    h  ON h.mes  = m.mes
    LEFT JOIN dia_hora dh ON dh.mes = m.mes
    LEFT JOIN extras   e  ON e.mes  = m.mes
    LEFT JOIN servicios sv ON sv.mes = m.mes
   ORDER BY m.mes;
$$;

GRANT EXECUTE ON FUNCTION public.estadisticas_ventas_agregadas(uuid, uuid, integer) TO authenticated, service_role;