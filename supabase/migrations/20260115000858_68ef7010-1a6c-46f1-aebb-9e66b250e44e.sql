-- Add rounding unit column to descuentos table
ALTER TABLE public.descuentos
ADD COLUMN IF NOT EXISTS redondeo_unidad INTEGER DEFAULT 100 CHECK (redondeo_unidad > 0);

-- Update redondeo check constraint to include 'matematico' option
ALTER TABLE public.descuentos DROP CONSTRAINT IF EXISTS descuentos_redondeo_check;
ALTER TABLE public.descuentos ADD CONSTRAINT descuentos_redondeo_check CHECK (redondeo IN ('cliente', 'negocio', 'matematico'));