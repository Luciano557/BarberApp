-- Fix existing backfill records missing sucursal_id
-- Assign sucursal_id based on the barbero's assigned sucursal
UPDATE ingresos 
SET sucursal_id = b.sucursal_id
FROM barberos b
WHERE ingresos.barbero_id = b.id
  AND ingresos.entry_mode = 'diferido'
  AND ingresos.sucursal_id IS NULL
  AND b.sucursal_id IS NOT NULL;