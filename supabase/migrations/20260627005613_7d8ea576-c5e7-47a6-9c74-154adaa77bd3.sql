
ALTER TABLE public."Egresos"
ADD COLUMN pago_sueldo_id uuid REFERENCES public.pagos_sueldos(id) ON DELETE SET NULL;

CREATE INDEX idx_egresos_pago_sueldo ON public."Egresos"(pago_sueldo_id);
