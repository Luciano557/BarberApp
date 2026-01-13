-- Add soft delete columns to venta table
ALTER TABLE public.venta 
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo',
ADD COLUMN IF NOT EXISTS anulado_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS anulado_por TEXT,
ADD COLUMN IF NOT EXISTS anulado_por_id TEXT;

-- Add an index for filtering by estado
CREATE INDEX IF NOT EXISTS idx_venta_estado ON public.venta(estado);

-- Comment explaining the fields
COMMENT ON COLUMN public.venta.estado IS 'Estado de la transacción: activo o anulado';
COMMENT ON COLUMN public.venta.anulado_at IS 'Fecha y hora de anulación';
COMMENT ON COLUMN public.venta.anulado_por IS 'Nombre de quien anuló la transacción (identificado por PIN)';
COMMENT ON COLUMN public.venta.anulado_por_id IS 'ID del barbero que anuló la transacción';