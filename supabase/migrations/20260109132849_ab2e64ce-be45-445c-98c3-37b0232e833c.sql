-- Crear tabla de líneas
CREATE TABLE public.lineas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.lineas ENABLE ROW LEVEL SECURITY;

-- Política de acceso completo
CREATE POLICY "Acceso completo lineas" ON public.lineas
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Agregar columna linea_id a servicios (nullable para servicios sin línea)
ALTER TABLE public.servicios 
ADD COLUMN linea_id UUID REFERENCES public.lineas(id) ON DELETE SET NULL;

-- Trigger para updated_at en lineas
CREATE TRIGGER update_lineas_updated_at
  BEFORE UPDATE ON public.lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();