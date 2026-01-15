-- Add new columns for advanced discount configuration
ALTER TABLE public.descuentos
ADD COLUMN IF NOT EXISTS redondeo TEXT DEFAULT 'cliente' CHECK (redondeo IN ('cliente', 'negocio')),
ADD COLUMN IF NOT EXISTS metodo_pago TEXT DEFAULT 'todos' CHECK (metodo_pago IN ('todos', 'efectivo', 'mercado_pago'));

-- Add comments for documentation
COMMENT ON COLUMN public.descuentos.redondeo IS 'Rounding direction: cliente = round down (favor customer), negocio = round up (favor business)';
COMMENT ON COLUMN public.descuentos.metodo_pago IS 'Payment method restriction: todos = all methods, efectivo = cash only, mercado_pago = MP only';