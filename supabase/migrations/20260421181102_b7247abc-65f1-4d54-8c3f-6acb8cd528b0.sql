ALTER TABLE public.venta
  DROP CONSTRAINT venta_metodo_pago_check;

ALTER TABLE public.venta
  ADD CONSTRAINT venta_metodo_pago_valido
  CHECK (metodo_pago = ANY (ARRAY[
    'efectivo'::text,
    'mercado_pago'::text,
    'transferencia'::text,
    'debito'::text,
    'credito'::text
  ]));