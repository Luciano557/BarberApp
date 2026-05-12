-- Security fix: stop persisting plaintext temp passwords in DB.
-- The temp password is only delivered through the edge function response (one-time channel).

-- Drop the plaintext column
ALTER TABLE public.sucursal_accounts
  DROP COLUMN IF EXISTS temp_password_visible;

-- Update the clear function to not reference the dropped column
CREATE OR REPLACE FUNCTION public.clear_sucursal_temp_password(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sucursal_accounts
     SET temp_password_pending = false,
         estado = 'Activa'
   WHERE user_id = p_user_id
     AND temp_password_pending = true;
$$;