ALTER TABLE public.agenda_config
  ADD COLUMN IF NOT EXISTS cancelacion_limite_hs integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS modificacion_limite_hs integer NOT NULL DEFAULT 2;

ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_email text,
  ADD COLUMN IF NOT EXISTS cancelado_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_motivo text;