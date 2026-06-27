
ALTER TABLE public."Egresos"
ADD COLUMN pago_deuda_id uuid REFERENCES public.pagos_deudas(id) ON DELETE SET NULL;

CREATE INDEX idx_egresos_pago_deuda ON public."Egresos"(pago_deuda_id);
