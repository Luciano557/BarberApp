-- Fix record 600: duplicate, mark as eliminated
UPDATE public.ingresos SET estado = 'eliminado' WHERE id = 600;

-- Fix records 601, 602: these are Feb 10 closings saved with Feb 11 timestamps
-- Set created_at to the business date (Feb 10 end of day) and closed_at to actual execution time
UPDATE public.ingresos 
SET created_at = '2026-02-10T23:59:59', 
    closed_at = '2026-02-11T15:24:45.438+00'
WHERE id = 601;

UPDATE public.ingresos 
SET created_at = '2026-02-10T23:59:59', 
    closed_at = '2026-02-11T15:24:50.666+00'
WHERE id = 602;