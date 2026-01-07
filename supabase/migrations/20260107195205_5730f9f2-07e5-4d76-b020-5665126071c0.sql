-- Tabla para servicios
CREATE TABLE public.servicios (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla para extras
CREATE TABLE public.extras (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla para barberos
CREATE TABLE public.barberos (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  commission NUMERIC NOT NULL DEFAULT 40,
  address TEXT,
  dni TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS (sin políticas restrictivas por ahora, ya que no hay auth)
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberos ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para todas las operaciones (sin autenticación)
CREATE POLICY "Permitir todas las operaciones en servicios" ON public.servicios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todas las operaciones en extras" ON public.extras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todas las operaciones en barberos" ON public.barberos FOR ALL USING (true) WITH CHECK (true);