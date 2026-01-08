-- Corregir vistas con SECURITY INVOKER (no DEFINER)
DROP VIEW IF EXISTS v_caja_sesion_resumen CASCADE;
DROP VIEW IF EXISTS v_venta_total CASCADE;
DROP VIEW IF EXISTS v_venta_linea_total CASCADE;

CREATE VIEW v_venta_linea_total 
WITH (security_invoker = true) AS
SELECT
  vs.id AS venta_servicio_id,
  vs.venta_id,
  vs.precio_unitario,
  vs.cantidad,
  vs.descuento_linea_pct,
  COALESCE(SUM(vse.precio_unitario * vse.cantidad),0) AS total_extras,
  ((vs.precio_unitario * vs.cantidad) * (1 - vs.descuento_linea_pct/100.0)
   + COALESCE(SUM(vse.precio_unitario * vse.cantidad),0)) AS total_linea
FROM venta_servicio vs
LEFT JOIN venta_servicio_extra vse ON vse.venta_servicio_id = vs.id
GROUP BY vs.id, vs.venta_id, vs.precio_unitario, vs.cantidad, vs.descuento_linea_pct;

CREATE VIEW v_venta_total 
WITH (security_invoker = true) AS
SELECT
  v.id AS venta_id,
  v.fecha_hora,
  v.barbero_id,
  v.metodo_pago,
  v.descuento_global_pct,
  COALESCE(SUM(l.total_linea),0) AS subtotal,
  COALESCE(SUM(l.total_linea),0) * (1 - v.descuento_global_pct/100.0) AS total_con_descuento
FROM venta v
LEFT JOIN v_venta_linea_total l ON l.venta_id = v.id
GROUP BY v.id, v.fecha_hora, v.barbero_id, v.metodo_pago, v.descuento_global_pct;

CREATE VIEW v_caja_sesion_resumen 
WITH (security_invoker = true) AS
SELECT
  cs.id AS caja_sesion_id,
  cs.abierta_en,
  cs.cerrada_en,
  cs.saldo_inicial,
  COALESCE((
    SELECT SUM(vt.total_con_descuento)
    FROM v_venta_total vt
    WHERE vt.metodo_pago = 'efectivo'
      AND vt.fecha_hora >= cs.abierta_en
      AND vt.fecha_hora < COALESCE(cs.cerrada_en, now())
  ),0) AS ventas_efectivo,
  COALESCE((
    SELECT SUM(vt.total_con_descuento)
    FROM v_venta_total vt
    WHERE vt.metodo_pago = 'mercado_pago'
      AND vt.fecha_hora >= cs.abierta_en
      AND vt.fecha_hora < COALESCE(cs.cerrada_en, now())
  ),0) AS ventas_mercado_pago,
  COALESCE((
    SELECT SUM(m.monto) FROM caja_movimiento m
    WHERE m.caja_sesion_id = cs.id AND m.tipo = 'ingreso'
  ),0) AS ingresos_manual,
  COALESCE((
    SELECT SUM(m.monto) FROM caja_movimiento m
    WHERE m.caja_sesion_id = cs.id AND m.tipo = 'egreso'
  ),0) AS egresos_manual,
  cs.saldo_inicial
    + COALESCE((
        SELECT SUM(vt.total_con_descuento)
        FROM v_venta_total vt
        WHERE vt.metodo_pago = 'efectivo'
          AND vt.fecha_hora >= cs.abierta_en
          AND vt.fecha_hora < COALESCE(cs.cerrada_en, now())
      ),0)
    + COALESCE((
        SELECT SUM(m.monto) FROM caja_movimiento m
        WHERE m.caja_sesion_id = cs.id AND m.tipo = 'ingreso'
      ),0)
    - COALESCE((
        SELECT SUM(m.monto) FROM caja_movimiento m
        WHERE m.caja_sesion_id = cs.id AND m.tipo = 'egreso'
      ),0) AS saldo_efectivo_proyectado
FROM caja_sesion cs;

-- Corregir función con search_path
CREATE OR REPLACE FUNCTION set_total_final_venta()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total_final = 0 THEN
    SELECT total_con_descuento INTO NEW.total_final
    FROM v_venta_total WHERE venta_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

-- Habilitar RLS en tablas antiguas que quedaron (Egresos, ingresos, ReportesMensuales)
ALTER TABLE "Egresos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReportesMensuales" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso completo Egresos" ON "Egresos" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo ingresos" ON ingresos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo ReportesMensuales" ON "ReportesMensuales" FOR ALL USING (true) WITH CHECK (true);