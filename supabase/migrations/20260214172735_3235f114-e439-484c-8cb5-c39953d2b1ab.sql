
-- Tabla de tareas y peticiones
CREATE TABLE public.tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  tipo TEXT NOT NULL DEFAULT 'tarea',
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  asignado_a_id UUID REFERENCES public.barberos(id),
  asignado_a_nombre TEXT,
  creado_por_id UUID NOT NULL,
  creado_por_nombre TEXT,
  recurrente BOOLEAN DEFAULT false,
  frecuencia_dias INTEGER,
  proxima_fecha DATE,
  fecha_limite DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

-- Owner y Manager: acceso total
CREATE POLICY "Owner/Manager full access tareas"
  ON public.tareas FOR ALL
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  );

-- Barberos: pueden crear peticiones
CREATE POLICY "Barbers can create peticiones"
  ON public.tareas FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND tipo = 'peticion'
    AND creado_por_id = auth.uid()
  );

-- Barberos: pueden ver sus propias tareas/peticiones
CREATE POLICY "Barbers can view own tasks"
  ON public.tareas FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (
      creado_por_id = auth.uid()
      OR asignado_a_id = public.get_user_barbero_id(auth.uid())
    )
  );

-- Trigger updated_at
CREATE TRIGGER update_tareas_updated_at
  BEFORE UPDATE ON public.tareas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
