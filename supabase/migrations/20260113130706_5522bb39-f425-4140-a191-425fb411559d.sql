-- Tabla para almacenar PINs hasheados por usuario
CREATE TABLE public.user_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Solo el propio usuario puede ver/modificar su PIN
ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pin"
ON public.user_pins FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pin"
ON public.user_pins FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pin"
ON public.user_pins FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own pin"
ON public.user_pins FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_user_pins_updated_at
BEFORE UPDATE ON public.user_pins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla para logs de acceso a secciones protegidas
CREATE TABLE public.access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    user_name TEXT,
    section TEXT NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    accessed_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para access_logs
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Solo dueños pueden ver los logs de su organización
CREATE POLICY "Owner can view org access logs"
ON public.access_logs FOR SELECT
TO authenticated
USING (
    organization_id = get_user_organization_id(auth.uid()) 
    AND has_role(auth.uid(), 'owner')
);

-- Usuarios autenticados pueden insertar sus propios logs
CREATE POLICY "Authenticated users can insert own logs"
ON public.access_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());