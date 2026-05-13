CREATE OR REPLACE FUNCTION public.clear_sucursal_temp_password(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sucursal_accounts
     SET temp_password_visible = NULL,
         temp_password_pending = false,
         estado = 'Activa'
   WHERE user_id = p_user_id
     AND temp_password_pending = true;
$$;