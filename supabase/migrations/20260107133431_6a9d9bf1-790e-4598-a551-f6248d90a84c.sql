-- Crear tabla de transacciones para registrar cada cobro
CREATE TABLE public.transacciones (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    barbero_id TEXT NOT NULL,
    barbero_nombre TEXT NOT NULL,
    servicio_id TEXT NOT NULL,
    servicio_nombre TEXT NOT NULL,
    servicio_precio NUMERIC NOT NULL,
    extras JSONB DEFAULT '[]'::jsonb,
    descuento NUMERIC DEFAULT 0,
    tipo_descuento TEXT CHECK (tipo_descuento IN ('fixed', 'percentage')) DEFAULT 'fixed',
    metodo_pago TEXT CHECK (metodo_pago IN ('efectivo', 'mercado_pago')) NOT NULL,
    subtotal NUMERIC NOT NULL,
    total NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;

-- Política para permitir insertar transacciones (cualquier usuario autenticado o anónimo por ahora)
CREATE POLICY "Permitir insertar transacciones" 
ON public.transacciones 
FOR INSERT 
WITH CHECK (true);

-- Política para permitir leer transacciones
CREATE POLICY "Permitir leer transacciones" 
ON public.transacciones 
FOR SELECT 
USING (true);

-- Política para permitir actualizar transacciones
CREATE POLICY "Permitir actualizar transacciones" 
ON public.transacciones 
FOR UPDATE 
USING (true);

-- Política para permitir eliminar transacciones
CREATE POLICY "Permitir eliminar transacciones" 
ON public.transacciones 
FOR DELETE 
USING (true);

-- Crear índice para búsquedas por fecha
CREATE INDEX idx_transacciones_created_at ON public.transacciones (created_at DESC);

-- Crear índice para búsquedas por barbero
CREATE INDEX idx_transacciones_barbero ON public.transacciones (barbero_id);