-- Drop the overly permissive policy that allows all users to see all barberos data
DROP POLICY IF EXISTS "Users can view own org barberos" ON public.barberos;

-- Barbers can only view their own record (using profile.barbero_id)
CREATE POLICY "Barber can view own record" 
ON public.barberos 
FOR SELECT 
USING (
  (organization_id = get_user_organization_id(auth.uid())) 
  AND has_role(auth.uid(), 'barber'::app_role) 
  AND (id = get_user_barbero_id(auth.uid()))
);

-- Managers can view all barberos in their organization
CREATE POLICY "Manager can view org barberos" 
ON public.barberos 
FOR SELECT 
USING (
  (organization_id = get_user_organization_id(auth.uid())) 
  AND has_role(auth.uid(), 'manager'::app_role)
);

-- Note: Owners already have full access via "Owner can modify own org barberos" ALL policy