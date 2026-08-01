ALTER TABLE public.resumenes_mensuales_estado
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz NULL DEFAULT NULL;

COMMENT ON COLUMN public.resumenes_mensuales_estado.dismissed_at IS
  'Momento en que el usuario descartó permanentemente este resumen. NULL = no descartado. A diferencia de postponed_at, el resumen no vuelve a mostrarse.';

ALTER TABLE public.resumenes_mensuales_estado
  ADD CONSTRAINT resumenes_mensuales_estado_read_dismiss_excl
  CHECK (read_at IS NULL OR dismissed_at IS NULL);

COMMENT ON CONSTRAINT resumenes_mensuales_estado_read_dismiss_excl ON public.resumenes_mensuales_estado IS
  'read_at y dismissed_at son estados terminales mutuamente excluyentes: o el usuario vio el resumen, o lo descartó sin verlo. Evita filas ambiguas que romperían la lógica de "qué resúmenes mostrar".';