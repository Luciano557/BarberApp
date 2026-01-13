-- Drop the overly permissive policies that allow cross-organization access
DROP POLICY IF EXISTS "Owner can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owner can update any profile" ON public.profiles;

-- Create a properly scoped update policy for owners (view policy already exists as "Owner can view org profiles")
CREATE POLICY "Owner can update org profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  (organization_id = get_user_organization_id(auth.uid())) 
  AND has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  (organization_id = get_user_organization_id(auth.uid())) 
  AND has_role(auth.uid(), 'owner'::app_role)
);