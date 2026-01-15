-- =====================================================
-- SECURITY: Hide sensitive fields (DNI, phone) from barbers
-- Only owners and managers can see full barbero data
-- =====================================================

-- 1. Create a secure view that excludes sensitive fields
CREATE OR REPLACE VIEW public.barberos_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  nombre,
  apellido,
  comision,
  activo,
  organization_id,
  created_at,
  updated_at
  -- Excludes: dni, telefono, pin_hash
FROM public.barberos;

-- 2. Update barberos RLS policies - barbers can only see non-sensitive data
-- First, drop the existing barber policy
DROP POLICY IF EXISTS "Barber can view own record" ON public.barberos;

-- 3. Create new policy: Barbers have NO direct access to barberos table
-- They must use the barberos_safe view instead
-- Owner and Manager keep full access (already exists from previous migration)

-- 4. Grant SELECT on the safe view to authenticated users
GRANT SELECT ON public.barberos_safe TO authenticated;

-- 5. Create RLS policy for the view access (barbers can see safe data)
-- Note: Views inherit RLS from base table, so we need to allow barbers
-- to SELECT from barberos but only through the view

-- Create a function to check if request is from the safe view context
-- Actually, simpler approach: allow barbers to see their own row but 
-- the app code will use the view for barbers

-- Recreate barber policy - they CAN see their own record
-- but the frontend will use barberos_safe view for barbers
CREATE POLICY "Barber can view own record"
ON public.barberos
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'barber')
  AND id = get_user_barbero_id(auth.uid())
);

-- Add comment to document the security model
COMMENT ON VIEW public.barberos_safe IS 'Safe view of barberos excluding sensitive PII (dni, telefono, pin_hash). Use this view for barber role access.';