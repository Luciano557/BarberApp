-- Crear tabla para pagos de sueldos
CREATE TABLE public.pagos_sueldos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barbero_id UUID NOT NULL,
  barbero_nombre TEXT NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  concepto TEXT,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pagos_sueldos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Owner and manager can do all on own org pagos_sueldos" 
ON public.pagos_sueldos 
FOR ALL
TO authenticated
USING (
  (organization_id = get_user_organization_id(auth.uid())) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
)
WITH CHECK (
  (organization_id = get_user_organization_id(auth.uid())) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Barber can view own pagos_sueldos" 
ON public.pagos_sueldos 
FOR SELECT
TO authenticated
USING (
  (organization_id = get_user_organization_id(auth.uid())) 
  AND has_role(auth.uid(), 'barber'::app_role) 
  AND (barbero_id = get_user_barbero_id(auth.uid()))
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pagos_sueldos_updated_at
BEFORE UPDATE ON public.pagos_sueldos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();