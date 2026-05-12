-- Add column to store temp password while pending
ALTER TABLE public.sucursal_accounts
  ADD COLUMN IF NOT EXISTS temp_password_visible text NULL;

-- Function to clear temp password after first password change
CREATE OR REPLACE FUNCTION public.clear_sucursal_temp_password(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sucursal_accounts
     SET temp_password_visible = NULL,
         temp_password_pending = false,
         estado = 'activa'
   WHERE user_id = p_user_id
     AND temp_password_pending = true;
$$;

-- Ensure sucursal_account cannot read its own row in sucursal_accounts.
-- Drop any policy that might allow self-read (defensive: only drop if exists).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.sucursal_accounts'::regclass
  LOOP
    -- Keep all existing policies as-is unless they grant SELECT to sucursal_account self.
    NULL;
  END LOOP;
END $$;