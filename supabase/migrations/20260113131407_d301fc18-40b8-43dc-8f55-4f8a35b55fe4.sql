-- Agregar columna pin_hash a barberos
ALTER TABLE public.barberos 
ADD COLUMN pin_hash TEXT;

-- Comentario para claridad
COMMENT ON COLUMN public.barberos.pin_hash IS 'PIN hasheado para acceso a secciones protegidas (solo dueños/encargados)';