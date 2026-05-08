-- Drop overly permissive policy that gave managers full access to servicios
DROP POLICY IF EXISTS "Owner GM and manager full access servicios" ON public.servicios;

-- Recreate granular policies (SELECT already covered by "Users can view org servicios")
CREATE POLICY "Owner and GM insert servicios"
ON public.servicios
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);

CREATE POLICY "Owner and GM update servicios"
ON public.servicios
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);

CREATE POLICY "Owner and GM delete servicios"
ON public.servicios
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);