-- Add compensation type fields to barberos table
ALTER TABLE public.barberos
  ADD COLUMN tipo_compensacion text NOT NULL DEFAULT 'comision',
  ADD COLUMN sueldo_fijo numeric DEFAULT NULL;

-- Add 'otros' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'otros';