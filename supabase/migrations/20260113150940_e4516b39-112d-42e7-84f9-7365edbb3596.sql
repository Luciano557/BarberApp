-- Actualizar la columna Usuario para usar el UUID de Sebastian en lugar del nombre
UPDATE public.ingresos 
SET "Usuario" = '5883955a-591b-4c18-9a6c-5f2bd6a86ac9'
WHERE "Usuario" = 'SEBASTIAN';