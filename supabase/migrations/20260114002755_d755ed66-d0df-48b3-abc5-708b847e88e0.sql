-- Fase 1: Agregar columna barbero_id a la tabla ingresos
ALTER TABLE ingresos 
ADD COLUMN barbero_id UUID REFERENCES barberos(id);

-- Fase 2: Migrar datos históricos

-- Paso 1: Vincular registros que coinciden exactamente con nombre completo
UPDATE ingresos i
SET barbero_id = b.id
FROM barberos b
WHERE i.barbero = b.nombre || ' ' || b.apellido
  AND i.barbero_id IS NULL
  AND i.organization_id = b.organization_id;

-- Paso 2: Vincular registros con solo primer nombre (casos históricos)
UPDATE ingresos i
SET barbero_id = b.id
FROM barberos b  
WHERE i.barbero = b.nombre
  AND i.barbero_id IS NULL
  AND i.organization_id = b.organization_id;

-- Paso 3: Vincular registros con nombres que tienen espacios extra
UPDATE ingresos i
SET barbero_id = b.id
FROM barberos b
WHERE TRIM(REGEXP_REPLACE(i.barbero, '\s+', ' ', 'g')) = TRIM(b.nombre || ' ' || b.apellido)
  AND i.barbero_id IS NULL
  AND i.organization_id = b.organization_id;

-- Fase 3: Crear índice para mejor rendimiento
CREATE INDEX idx_ingresos_barbero_id ON ingresos(barbero_id);

-- Comentario: Los registros que no se pudieron vincular permanecerán con barbero_id NULL
-- Se puede verificar cuántos huérfanos hay con:
-- SELECT barbero, COUNT(*) FROM ingresos WHERE barbero_id IS NULL GROUP BY barbero;