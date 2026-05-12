-- Phase 1.0: Add sucursal_account to app_role enum
-- Must be in its own migration so the value is committed before being referenced.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sucursal_account';