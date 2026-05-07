-- 1. Add access_email column
ALTER TABLE public.barberos
  ADD COLUMN IF NOT EXISTS access_email TEXT NULL;

-- 2. Index for email lookups within org
CREATE INDEX IF NOT EXISTS idx_barberos_org_access_email
  ON public.barberos (organization_id, lower(access_email))
  WHERE access_email IS NOT NULL;

-- 3. Constraint: manager must have sucursal (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_manager_requires_sucursal'
      AND conrelid = 'public.barberos'::regclass
  ) THEN
    ALTER TABLE public.barberos
      ADD CONSTRAINT check_manager_requires_sucursal
      CHECK (rol_equipo <> 'manager' OR sucursal_id IS NOT NULL);
  END IF;
END $$;

-- 4. Unique active manager per sucursal (safe: verified no duplicates exist)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_manager_per_sucursal
  ON public.barberos (organization_id, sucursal_id)
  WHERE activo = true AND rol_equipo = 'manager';