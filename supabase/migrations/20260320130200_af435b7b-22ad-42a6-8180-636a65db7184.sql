-- Backfill: assign sucursal_id to all ventas that are missing it
UPDATE venta
SET sucursal_id = 'ca6babf5-4d85-44c3-86b7-f8cd2c25a4da'
WHERE sucursal_id IS NULL
  AND organization_id IS NOT NULL;