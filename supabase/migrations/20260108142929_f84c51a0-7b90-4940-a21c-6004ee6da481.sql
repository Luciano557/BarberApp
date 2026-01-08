-- =========================================
-- BARBERÍA POS – Migración completa
-- =========================================

-- 1) Tipos enumerados
DO $$ BEGIN
  CREATE TYPE metodo_pago AS ENUM ('efectivo','mercado_pago');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE caja_mov_tipo AS ENUM ('ingreso','egreso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Catálogos nuevos
CREATE TABLE IF NOT EXISTS barbero (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  comision      NUMERIC(5,2) NOT NULL DEFAULT 40 CHECK (comision BETWEEN 0 AND 100),
  telefono      TEXT,
  direccion     TEXT,
  dni           TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS servicio (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  precio_base   NUMERIC(12,2) NOT NULL CHECK (precio_base >= 0),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extra (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  precio_base   NUMERIC(12,2) NOT NULL CHECK (precio_base >= 0),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 3) Migrar datos existentes
INSERT INTO barbero (nombre, comision, telefono, direccion, dni, activo, created_at)
SELECT 
  CONCAT(first_name, ' ', last_name),
  commission,
  phone,
  address,
  dni,
  active,
  created_at
FROM barberos
ON CONFLICT DO NOTHING;

INSERT INTO servicio (nombre, precio_base, activo, created_at)
SELECT name, price, active, created_at
FROM servicios
ON CONFLICT DO NOTHING;

INSERT INTO extra (nombre, precio_base, activo, created_at)
SELECT name, price, active, created_at
FROM extras
ON CONFLICT DO NOTHING;

-- 4) Ventas (encabezado)
CREATE TABLE IF NOT EXISTS venta (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha_hora                timestamptz NOT NULL DEFAULT now(),
  barbero_id                BIGINT      NOT NULL REFERENCES barbero(id),
  descuento_global_pct      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_global_pct BETWEEN 0 AND 100),
  metodo_pago               metodo_pago  NOT NULL,
  observaciones             TEXT,
  total_final               NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_final >= 0),
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_venta_fecha      ON venta(fecha_hora);
CREATE INDEX IF NOT EXISTS ix_venta_barbero    ON venta(barbero_id);
CREATE INDEX IF NOT EXISTS ix_venta_metodo     ON venta(metodo_pago);

-- 5) Líneas de servicio por venta (1..N)
CREATE TABLE IF NOT EXISTS venta_servicio (
  id                         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venta_id                   BIGINT NOT NULL REFERENCES venta(id) ON DELETE CASCADE,
  servicio_id                BIGINT NOT NULL REFERENCES servicio(id),
  precio_unitario            NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  cantidad                   INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  descuento_linea_pct        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_linea_pct BETWEEN 0 AND 100),
  created_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_vs_venta ON venta_servicio(venta_id);

-- 6) Extras por línea de servicio (0..N)
CREATE TABLE IF NOT EXISTS venta_servicio_extra (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venta_servicio_id    BIGINT NOT NULL REFERENCES venta_servicio(id) ON DELETE CASCADE,
  extra_id             BIGINT NOT NULL REFERENCES extra(id),
  precio_unitario      NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  cantidad             INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_vse UNIQUE (venta_servicio_id, extra_id)
);

CREATE INDEX IF NOT EXISTS ix_vse_vs ON venta_servicio_extra(venta_servicio_id);

-- 7) Caja: sesiones de apertura/cierre
CREATE TABLE IF NOT EXISTS caja_sesion (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  abierta_por       TEXT NOT NULL,
  abierta_en        timestamptz NOT NULL DEFAULT now(),
  saldo_inicial     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (saldo_inicial >= 0),
  cerrada_en        timestamptz,
  cerrada_por       TEXT,
  saldo_final       NUMERIC(12,2),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 8) Movimientos manuales de caja
CREATE TABLE IF NOT EXISTS caja_movimiento (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caja_sesion_id    BIGINT NOT NULL REFERENCES caja_sesion(id) ON DELETE CASCADE,
  tipo              caja_mov_tipo NOT NULL,
  concepto          TEXT NOT NULL,
  monto             NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  creado_en         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_caja_mov_sesion ON caja_movimiento(caja_sesion_id);

-- 9) Vistas de totales
CREATE OR REPLACE VIEW v_venta_linea_total AS
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

CREATE OR REPLACE VIEW v_venta_total AS
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

CREATE OR REPLACE VIEW v_caja_sesion_resumen AS
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

-- 10) Trigger para total_final
CREATE OR REPLACE FUNCTION set_total_final_venta()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.total_final = 0 THEN
    SELECT total_con_descuento INTO NEW.total_final
    FROM v_venta_total WHERE venta_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_total_final_venta ON venta;
CREATE TRIGGER trg_set_total_final_venta
AFTER INSERT OR UPDATE OF descuento_global_pct ON venta
FOR EACH ROW EXECUTE FUNCTION set_total_final_venta();

-- 11) RLS para todas las tablas nuevas
ALTER TABLE barbero ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_servicio_extra ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_sesion ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_movimiento ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (sin autenticación por ahora)
CREATE POLICY "Acceso completo barbero" ON barbero FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo servicio" ON servicio FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo extra" ON extra FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo venta" ON venta FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo venta_servicio" ON venta_servicio FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo venta_servicio_extra" ON venta_servicio_extra FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo caja_sesion" ON caja_sesion FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo caja_movimiento" ON caja_movimiento FOR ALL USING (true) WITH CHECK (true);

-- 12) Eliminar tablas antiguas (después de migrar datos)
DROP TABLE IF EXISTS transacciones CASCADE;
DROP TABLE IF EXISTS barberos CASCADE;
DROP TABLE IF EXISTS servicios CASCADE;
DROP TABLE IF EXISTS extras CASCADE;