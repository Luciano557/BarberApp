-- Habilitar RLS en plan_features (tabla de solo lectura pública)
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- Política para que todos los usuarios autenticados puedan ver los planes
CREATE POLICY "Anyone can view plan features"
ON public.plan_features FOR SELECT
USING (true);