
ALTER TABLE public.pagos_deudas
DROP COLUMN egreso_id;

ALTER TABLE public.pagos_deudas
ADD COLUMN egreso_id bigint REFERENCES public."Egresos"(id) ON DELETE SET NULL;
