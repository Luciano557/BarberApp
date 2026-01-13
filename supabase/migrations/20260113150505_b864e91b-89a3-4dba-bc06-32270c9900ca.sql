-- Actualizar registros de Sebastian en ingresos con nombre completo y UUID del barbero
UPDATE public.ingresos 
SET 
  barbero = 'Sebastian Tello',
  identificador = '5883955a-591b-4c18-9a6c-5f2bd6a86ac9'::uuid
WHERE barbero = 'Sebastian';