-- Crear tabla para historial de anulaciones de cierre de caja
CREATE TABLE public.anulaciones_cierre (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ingreso_id INTEGER NOT NULL,
  barbero_nombre TEXT NOT NULL,
  fecha_cierre DATE NOT NULL,
  anulado_por_id UUID NOT NULL,
  anulado_por_nombre TEXT NOT NULL,
  anulado_por_email TEXT NOT NULL,
  anulado_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  motivo TEXT,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.anulaciones_cierre ENABLE ROW LEVEL SECURITY;

-- Política de lectura: usuarios de la misma organización
CREATE POLICY "Users can view anulaciones from their organization"
ON public.anulaciones_cierre
FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.uid())
);

-- Política de inserción: solo usuarios autenticados de la misma organización
CREATE POLICY "Users can insert anulaciones for their organization"
ON public.anulaciones_cierre
FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
);

-- Índices para mejor rendimiento
CREATE INDEX idx_anulaciones_cierre_org ON public.anulaciones_cierre(organization_id);
CREATE INDEX idx_anulaciones_cierre_fecha ON public.anulaciones_cierre(fecha_cierre);
CREATE INDEX idx_anulaciones_cierre_ingreso ON public.anulaciones_cierre(ingreso_id);