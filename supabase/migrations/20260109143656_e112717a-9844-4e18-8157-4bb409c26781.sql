-- 1. Crear enum para roles
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'barber');

-- 2. Crear tabla de perfiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  barbero_id UUID REFERENCES public.barberos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Crear tabla de roles de usuario
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Función para verificar roles (SECURITY DEFINER para evitar recursión)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Función para obtener el barbero_id del usuario
CREATE OR REPLACE FUNCTION public.get_user_barbero_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT barbero_id FROM public.profiles WHERE id = _user_id
$$;

-- 6. Función para obtener el nombre del barbero del usuario
CREATE OR REPLACE FUNCTION public.get_user_barbero_name(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.nombre || ' ' || b.apellido
  FROM public.profiles p
  JOIN public.barberos b ON b.id = p.barbero_id
  WHERE p.id = _user_id
$$;

-- 7. Trigger para crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Crear perfil
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  -- Contar usuarios existentes
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  
  -- Si es el primer usuario, asignar rol de owner
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Trigger para actualizar updated_at en profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. RLS Policies para profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Owner can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Owner can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- 10. RLS Policies para user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- 11. Actualizar RLS en ingresos (cierres de caja)
DROP POLICY IF EXISTS "Acceso completo ingresos" ON public.ingresos;

CREATE POLICY "Owner and manager can view all ingresos"
  ON public.ingresos FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Barber can view own ingresos"
  ON public.ingresos FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'barber') AND
    barbero = public.get_user_barbero_name(auth.uid())
  );

CREATE POLICY "Owner and manager can insert ingresos"
  ON public.ingresos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Barber can insert own ingresos"
  ON public.ingresos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'barber') AND
    barbero = public.get_user_barbero_name(auth.uid())
  );

CREATE POLICY "Owner and manager can update ingresos"
  ON public.ingresos FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 12. Actualizar RLS en venta
DROP POLICY IF EXISTS "Acceso completo venta" ON public.venta;

CREATE POLICY "Owner and manager can do all on venta"
  ON public.venta FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Barber can view own venta"
  ON public.venta FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'barber') AND
    barbero_id = public.get_user_barbero_id(auth.uid())
  );

-- 13. Actualizar RLS en venta_extra
DROP POLICY IF EXISTS "Acceso completo venta_extra" ON public.venta_extra;

CREATE POLICY "Owner and manager can do all on venta_extra"
  ON public.venta_extra FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Barber can view own venta_extra"
  ON public.venta_extra FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'barber') AND
    venta_id IN (
      SELECT id FROM public.venta 
      WHERE barbero_id = public.get_user_barbero_id(auth.uid())
    )
  );

-- 14. Actualizar RLS en servicios (owner y manager pueden modificar, todos pueden leer)
DROP POLICY IF EXISTS "Acceso completo servicios" ON public.servicios;

CREATE POLICY "Authenticated can view servicios"
  ON public.servicios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owner and manager can modify servicios"
  ON public.servicios FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 15. Actualizar RLS en extras
DROP POLICY IF EXISTS "Acceso completo extras" ON public.extras;

CREATE POLICY "Authenticated can view extras"
  ON public.extras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owner and manager can modify extras"
  ON public.extras FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 16. Actualizar RLS en descuentos
DROP POLICY IF EXISTS "Acceso completo descuentos" ON public.descuentos;

CREATE POLICY "Authenticated can view descuentos"
  ON public.descuentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owner and manager can modify descuentos"
  ON public.descuentos FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 17. Actualizar RLS en lineas
DROP POLICY IF EXISTS "Acceso completo lineas" ON public.lineas;

CREATE POLICY "Authenticated can view lineas"
  ON public.lineas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owner and manager can modify lineas"
  ON public.lineas FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 18. Actualizar RLS en barberos (solo owner puede modificar)
DROP POLICY IF EXISTS "Acceso completo barberos" ON public.barberos;

CREATE POLICY "Authenticated can view barberos"
  ON public.barberos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owner can modify barberos"
  ON public.barberos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- 19. Actualizar RLS en Egresos (owner y manager)
DROP POLICY IF EXISTS "Acceso completo Egresos" ON public."Egresos";

CREATE POLICY "Owner and manager can do all on Egresos"
  ON public."Egresos" FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 20. Actualizar RLS en ReportesMensuales
DROP POLICY IF EXISTS "Acceso completo ReportesMensuales" ON public."ReportesMensuales";

CREATE POLICY "Owner and manager can do all on ReportesMensuales"
  ON public."ReportesMensuales" FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'manager')
  );