-- Clean up extra spaces in barberos table
UPDATE barberos 
SET nombre = TRIM(REGEXP_REPLACE(nombre, '\s+', ' ', 'g')),
    apellido = TRIM(REGEXP_REPLACE(apellido, '\s+', ' ', 'g'));

-- Clean up extra spaces in pagos_sueldos table
UPDATE pagos_sueldos 
SET barbero_nombre = TRIM(REGEXP_REPLACE(barbero_nombre, '\s+', ' ', 'g'));

-- Clean up extra spaces in ingresos table (barbero field)
UPDATE ingresos 
SET barbero = TRIM(REGEXP_REPLACE(barbero, '\s+', ' ', 'g'))
WHERE barbero IS NOT NULL;

-- Clean up extra spaces in venta table (barbero_nombre field)
UPDATE venta 
SET barbero_nombre = TRIM(REGEXP_REPLACE(barbero_nombre, '\s+', ' ', 'g'));