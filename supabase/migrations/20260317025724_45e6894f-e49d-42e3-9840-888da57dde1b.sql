-- Add sucursal_id to servicios, extras, and descuentos
ALTER TABLE servicios ADD COLUMN sucursal_id uuid REFERENCES sucursales(id);
ALTER TABLE extras ADD COLUMN sucursal_id uuid REFERENCES sucursales(id);
ALTER TABLE descuentos ADD COLUMN sucursal_id uuid REFERENCES sucursales(id);

-- Backfill: assign existing records to the first sucursal of their organization
UPDATE servicios s SET sucursal_id = (
  SELECT id FROM sucursales WHERE organization_id = s.organization_id ORDER BY created_at LIMIT 1
) WHERE s.sucursal_id IS NULL;

UPDATE extras e SET sucursal_id = (
  SELECT id FROM sucursales WHERE organization_id = e.organization_id ORDER BY created_at LIMIT 1
) WHERE e.sucursal_id IS NULL;

UPDATE descuentos d SET sucursal_id = (
  SELECT id FROM sucursales WHERE organization_id = d.organization_id ORDER BY created_at LIMIT 1
) WHERE d.sucursal_id IS NULL;