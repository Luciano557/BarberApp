CREATE OR REPLACE FUNCTION public.generar_resumenes_mensuales(target_mes date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes date;
  r record;
  v_tz text;
  m_start timestamptz; m_end timestamptz;
  p1_start timestamptz; p1_end timestamptz;
  p2_start timestamptz; p2_end timestamptz;
  fact numeric[] := ARRAY[0,0,0]::numeric[];
  serv integer[] := ARRAY[0,0,0];
  egr numeric[] := ARRAY[0,0,0]::numeric[];
  rent numeric[] := ARRAY[NULL,NULL,NULL]::numeric[];
  i int;
  s_start timestamptz; s_end timestamptz;
  t_fact numeric; t_serv integer; t_egr numeric;
  v_metodos jsonb;
  v_count integer := 0;
BEGIN
  v_mes := COALESCE(date_trunc('month', target_mes)::date,
                    (date_trunc('month', now()) - interval '1 month')::date);

  FOR r IN
    SELECT s.id AS sucursal_id, s.organization_id,
           COALESCE(NULLIF(s.timezone,''), NULLIF(o.timezone,''), 'America/Argentina/Buenos_Aires') AS tz
    FROM public.sucursales s
    JOIN public.organizations o ON o.id = s.organization_id
    WHERE s.activa = true AND s.deleted_at IS NULL
  LOOP
    v_tz := r.tz;

    FOR i IN 0..2 LOOP
      s_start := ((v_mes - (i || ' month')::interval)::timestamp) AT TIME ZONE v_tz;
      s_end := ((v_mes - (i || ' month')::interval + interval '1 month')::timestamp) AT TIME ZONE v_tz;

      -- Facturación y servicios: espejo de useEstadisticasData.ts (tabla ingresos,
      -- created_at dentro del mes, estado <> 'eliminado')
      SELECT COALESCE(SUM(ing.total_facturado),0),
             COALESCE(SUM(ing.cantidad_de_servicios),0)
        INTO t_fact, t_serv
        FROM public.ingresos ing
       WHERE ing.organization_id = r.organization_id
         AND ing.sucursal_id = r.sucursal_id
         AND ing.estado IS DISTINCT FROM 'eliminado'
         AND ing.created_at >= s_start AND ing.created_at < s_end;
      fact[i+1] := t_fact;
      serv[i+1] := t_serv;

      -- Egresos activos (fijos + variables + semivariables), espejo de useEstadisticasData.ts
      SELECT COALESCE(SUM(e."Monto"),0)
        INTO t_egr
        FROM public."Egresos" e
       WHERE e.organization_id = r.organization_id
         AND e.sucursal_id = r.sucursal_id
         AND e.estado = 'activo'
         AND e.tipo_costo IN ('fijo','variable','semivariable')
         AND e."Fecha" >= s_start AND e."Fecha" < s_end;
      egr[i+1] := t_egr;

      -- Rentabilidad: espejo de derivedMetrics en EstadisticasPanel.tsx
      IF fact[i+1] > 0 THEN
        rent[i+1] := ((fact[i+1] - egr[i+1]) / fact[i+1]) * 100;
      ELSE
        rent[i+1] := 0;
      END IF;
    END LOOP;

    m_start := ((v_mes)::timestamp) AT TIME ZONE v_tz;
    m_end := ((v_mes + interval '1 month')::timestamp) AT TIME ZONE v_tz;
    p1_start := ((v_mes - interval '1 month')::timestamp) AT TIME ZONE v_tz;
    p1_end := m_start;
    p2_start := ((v_mes - interval '2 month')::timestamp) AT TIME ZONE v_tz;
    p2_end := p1_start;

    -- Métodos de cobro: espejo de usePagoMetodoData.ts. venta_pagos por venta activa;
    -- si la venta no tiene filas en venta_pagos, cuenta como un pago único con
    -- venta.metodo_pago + venta.total_final.
    WITH ventas AS (
      SELECT v.id, v.metodo_pago, v.total_final, v.fecha_hora
        FROM public.venta v
       WHERE v.organization_id = r.organization_id
         AND v.sucursal_id = r.sucursal_id
         AND v.estado = 'activo'
         AND v.fecha_hora >= p1_start AND v.fecha_hora < m_end
    ), pagos AS (
      SELECT vt.fecha_hora, vp.metodo_pago::text AS metodo, vp.monto::numeric AS monto
        FROM ventas vt
        JOIN public.venta_pagos vp ON vp.venta_id = vt.id
      UNION ALL
      SELECT vt.fecha_hora, vt.metodo_pago::text, vt.total_final::numeric
        FROM ventas vt
       WHERE NOT EXISTS (SELECT 1 FROM public.venta_pagos vp WHERE vp.venta_id = vt.id)
    ), agg AS (
      SELECT metodo,
             COALESCE(SUM(monto) FILTER (WHERE fecha_hora >= m_start), 0) AS actual,
             COALESCE(SUM(monto) FILTER (WHERE fecha_hora < m_start), 0) AS anterior
        FROM pagos
       WHERE metodo IN ('efectivo','mercado_pago','transferencia','debito','credito')
       GROUP BY metodo
    ), base AS (
      SELECT m AS metodo FROM unnest(ARRAY['efectivo','mercado_pago','transferencia','debito','credito']) m
    )
    SELECT jsonb_object_agg(b.metodo, jsonb_build_object(
             'actual', COALESCE(a.actual,0),
             'mes_anterior', COALESCE(a.anterior,0),
             'var_pct', CASE WHEN COALESCE(a.anterior,0) > 0
                             THEN ROUND(((COALESCE(a.actual,0) - a.anterior) / a.anterior) * 100, 2)
                             ELSE NULL END))
      INTO v_metodos
      FROM base b LEFT JOIN agg a ON a.metodo = b.metodo;

    INSERT INTO public.resumenes_mensuales (
      organization_id, sucursal_id, mes,
      facturacion_actual, facturacion_mes_anterior, facturacion_hace_2_meses,
      servicios_actual, servicios_mes_anterior, servicios_hace_2_meses,
      rentabilidad_pct, rentabilidad_mes_anterior_pct, rentabilidad_hace_2_meses_pct,
      metodos_cobro, generado_at
    ) VALUES (
      r.organization_id, r.sucursal_id, v_mes,
      fact[1], fact[2], fact[3],
      serv[1], serv[2], serv[3],
      ROUND(rent[1],2), ROUND(rent[2],2), ROUND(rent[3],2),
      COALESCE(v_metodos, '{}'::jsonb), now()
    )
    ON CONFLICT (organization_id, sucursal_id, mes) DO UPDATE SET
      facturacion_actual = EXCLUDED.facturacion_actual,
      facturacion_mes_anterior = EXCLUDED.facturacion_mes_anterior,
      facturacion_hace_2_meses = EXCLUDED.facturacion_hace_2_meses,
      servicios_actual = EXCLUDED.servicios_actual,
      servicios_mes_anterior = EXCLUDED.servicios_mes_anterior,
      servicios_hace_2_meses = EXCLUDED.servicios_hace_2_meses,
      rentabilidad_pct = EXCLUDED.rentabilidad_pct,
      rentabilidad_mes_anterior_pct = EXCLUDED.rentabilidad_mes_anterior_pct,
      rentabilidad_hace_2_meses_pct = EXCLUDED.rentabilidad_hace_2_meses_pct,
      metodos_cobro = EXCLUDED.metodos_cobro,
      generado_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generar_resumenes_mensuales(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generar_resumenes_mensuales(date) TO service_role;