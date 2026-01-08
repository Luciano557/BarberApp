-- Tabla principal de ventas
CREATE TABLE public.venta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbero_id UUID NOT NULL REFERENCES public.barberos(id),
  barbero_nombre TEXT NOT NULL,
  servicio_id UUID NOT NULL REFERENCES public.servicios(id),
  servicio_nombre TEXT NOT NULL,
  precio_servicio NUMERIC NOT NULL DEFAULT 0,
  descuento_pct NUMERIC DEFAULT 0,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'mercado_pago')),
  total_final NUMERIC NOT NULL DEFAULT 0,
  fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de extras por venta
CREATE TABLE public.venta_extra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES public.venta(id) ON DELETE CASCADE,
  extra_id UUID NOT NULL REFERENCES public.extras(id),
  extra_nombre TEXT NOT NULL,
  precio_extra NUMERIC NOT NULL DEFAULT 0,
  cantidad INTEGER NOT NULL DEFAULT 1
);

-- Habilitar RLS
ALTER TABLE public.venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_extra ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso completo
CREATE POLICY "Acceso completo venta" ON public.venta FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo venta_extra" ON public.venta_extra FOR ALL USING (true) WITH CHECK (true);

-- Índices para mejor rendimiento
CREATE INDEX idx_venta_barbero ON public.venta(barbero_id);
CREATE INDEX idx_venta_fecha ON public.venta(fecha_hora);
CREATE INDEX idx_venta_extra_venta ON public.venta_extra(venta_id);