
-- Eliminar el pago duplicado erróneo de $6.48
DELETE FROM pagos_sueldos 
WHERE id = 'ae033246-d4c8-4e3c-aab3-b0a58ccda780';

-- Insertar pago para compensar el barbero "Sebastian" (registro antiguo sin apellido)
INSERT INTO pagos_sueldos (
  barbero_id,
  barbero_nombre,
  monto,
  fecha,
  concepto,
  organization_id
)
SELECT 
  '5883955a-591b-4c18-9a6c-5f2bd6a86ac9',
  'Sebastian',
  56000,
  '2026-01-13',
  'normalizar datos - registros antiguos',
  organization_id
FROM profiles LIMIT 1;
