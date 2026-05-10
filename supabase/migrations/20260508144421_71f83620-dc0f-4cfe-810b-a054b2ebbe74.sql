-- 1) Block direct read of pin_hash via the API (frontend / anon)
REVOKE SELECT (pin_hash) ON public.barberos FROM authenticated, anon;

-- 2) Helper RPC: PIN status for a list of barberos in the user's org
CREATE OR REPLACE FUNCTION public.barberos_pin_status(_ids uuid[])
RETURNS TABLE(id uuid, has_pin boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, (b.pin_hash IS NOT NULL) AS has_pin
  FROM public.barberos b
  WHERE b.id = ANY(_ids)
    AND b.organization_id = public.get_user_organization_id(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.barberos_pin_status(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.barberos_pin_status(uuid[]) TO authenticated;

-- 3) Helper RPC: does the current user's organization have any active PIN configured?
CREATE OR REPLACE FUNCTION public.org_has_any_pin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.barberos b
    WHERE b.organization_id = public.get_user_organization_id(auth.uid())
      AND b.activo = true
      AND b.pin_hash IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.org_has_any_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_has_any_pin() TO authenticated;

-- 4) Helper RPC: does the current user's own barbero record have a PIN?
CREATE OR REPLACE FUNCTION public.current_user_has_pin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.barberos b
    JOIN public.profiles p ON p.barbero_id = b.id
    WHERE p.id = auth.uid()
      AND b.pin_hash IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_pin() TO authenticated;