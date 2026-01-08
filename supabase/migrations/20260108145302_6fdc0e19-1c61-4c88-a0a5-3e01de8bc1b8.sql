-- Agregar columna de comisión a la tabla barberos
ALTER TABLE public.barberos 
ADD COLUMN comision numeric NOT NULL DEFAULT 0 CHECK (comision >= 0 AND comision <= 100);