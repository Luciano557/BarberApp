-- Create gastos_recurrentes table
CREATE TABLE public.gastos_recurrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sucursal_id uuid,
  categoria text NOT NULL,
  tipo_costo text NOT NULL DEFAULT 'fijo',
  monto numeric NOT NULL,
  descripcion text,
  repeat_preset text NOT NULL DEFAULT 'monthly',
  repeat_frequency text,
  repeat_interval integer DEFAULT 1,
  repeat_byweekday integer[],
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  proxima_fecha date NOT NULL DEFAULT CURRENT_DATE,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gastos_recurrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manager and GM full access gastos_recurrentes"
ON public.gastos_recurrentes FOR ALL TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'general_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'general_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Add gasto_recurrente_id to Egresos
ALTER TABLE public."Egresos" ADD COLUMN gasto_recurrente_id uuid;