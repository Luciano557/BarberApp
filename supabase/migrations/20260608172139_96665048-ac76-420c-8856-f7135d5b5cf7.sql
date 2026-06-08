ALTER TABLE public.barberos_sucursales DROP CONSTRAINT IF EXISTS uniq_barbero_sucursal;
DROP INDEX IF EXISTS public.uniq_barbero_sucursal;
CREATE UNIQUE INDEX uniq_barbero_sucursal_principal ON public.barberos_sucursales (barbero_id, sucursal_id) WHERE tipo = 'principal';
CREATE UNIQUE INDEX uniq_barbero_sucursal_recurrente ON public.barberos_sucursales (barbero_id, sucursal_id) WHERE tipo = 'recurrente';