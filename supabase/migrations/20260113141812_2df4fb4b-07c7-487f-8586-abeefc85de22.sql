-- Actualizar registros de Tomas en ingresos con nombre completo y UUID del barbero
UPDATE public.ingresos 
SET 
  barbero = 'Tomas Bazante',
  identificador = '30aa6eae-07eb-4a3b-9e68-8a043e72d750'::uuid
WHERE barbero = 'Tomas';