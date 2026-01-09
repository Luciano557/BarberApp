-- Add a JSONB column to store dynamic line counts
ALTER TABLE public.ingresos 
ADD COLUMN IF NOT EXISTS servicios_por_linea jsonb DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN public.ingresos.servicios_por_linea IS 'JSON object with line names as keys and service counts as values';