ALTER TABLE public.turnos
  ADD COLUMN overlap_autorizado boolean NOT NULL DEFAULT false;

ALTER TABLE public.turnos DROP CONSTRAINT no_overlap_turnos;

ALTER TABLE public.turnos
  ADD CONSTRAINT no_overlap_turnos
  EXCLUDE USING gist (
    sucursal_id WITH =,
    barbero_id  WITH =,
    rango_horario WITH &&
  )
  WHERE (
    estado = ANY (ARRAY['pendiente'::text, 'confirmado'::text, 'en_curso'::text])
    AND overlap_autorizado = false
  );