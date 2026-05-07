
ALTER TABLE public.barberos
  ADD COLUMN IF NOT EXISTS roles_equipo text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE public.barberos
SET roles_equipo = CASE
  WHEN rol_equipo = 'owner' THEN ARRAY['owner']
  WHEN rol_equipo = 'general_manager' THEN ARRAY['general_manager']
  WHEN rol_equipo = 'manager' THEN ARRAY['manager']
  WHEN rol_equipo = 'barbero' THEN ARRAY['barber']
  WHEN rol_equipo = 'otros' THEN ARRAY['otros']
  ELSE ARRAY['barber']
END
WHERE COALESCE(array_length(roles_equipo, 1), 0) = 0;
