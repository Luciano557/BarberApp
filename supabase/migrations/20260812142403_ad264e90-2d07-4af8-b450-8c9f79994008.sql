DROP POLICY IF EXISTS "portal_config_insert_admins" ON public.portal_config;
DROP POLICY IF EXISTS "portal_config_update_admins" ON public.portal_config;

CREATE POLICY "portal_config_insert_admins"
ON public.portal_config FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);

CREATE POLICY "portal_config_update_admins"
ON public.portal_config FOR UPDATE
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