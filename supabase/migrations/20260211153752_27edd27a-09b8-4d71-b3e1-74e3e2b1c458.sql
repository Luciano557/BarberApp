
-- 1. Agregar columna closed_at para registrar momento real del cierre
ALTER TABLE public.ingresos ADD COLUMN closed_at TIMESTAMPTZ DEFAULT now();

-- 2. Backfill: para registros existentes, closed_at = created_at
UPDATE public.ingresos SET closed_at = created_at WHERE closed_at IS NULL;
