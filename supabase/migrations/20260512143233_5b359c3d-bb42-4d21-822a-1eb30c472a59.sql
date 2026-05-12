
-- =========================================================================
-- Phase 1.1: sucursal_accounts, sucursal_action_pin_config, helpers, RLS
-- =========================================================================

-- ---------- 1. Helper: is_sucursal_account ----------
CREATE OR REPLACE FUNCTION public.is_sucursal_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'sucursal_account'::app_role)
$$;

-- ---------- 2. sucursal_accounts table ----------
CREATE TABLE IF NOT EXISTS public.sucursal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sucursal_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  estado text NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente','Contraseña temporal','Activa','Inactiva')),
  temp_password_pending boolean NOT NULL DEFAULT true,
  last_password_reset_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sucursal_accounts_org ON public.sucursal_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_sucursal_accounts_sucursal ON public.sucursal_accounts(sucursal_id);

ALTER TABLE public.sucursal_accounts ENABLE ROW LEVEL SECURITY;

-- Owner / GM full access
CREATE POLICY "Owner GM full access sucursal_accounts"
  ON public.sucursal_accounts FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  );

-- Manager only their assigned sucursales
CREATE POLICY "Manager view assigned sucursal_accounts"
  ON public.sucursal_accounts FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(),'manager')
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- Trigger: updated_at
CREATE TRIGGER trg_sucursal_accounts_updated_at
  BEFORE UPDATE ON public.sucursal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 3. sucursal_action_pin_config ----------
CREATE TABLE IF NOT EXISTS public.sucursal_action_pin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sucursal_id uuid, -- NULL = configuración general de la organización
  action_key text NOT NULL,
  requires_pin boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sucursal_id, action_key)
);

-- Partial unique index for general (sucursal_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sapc_general
  ON public.sucursal_action_pin_config(organization_id, action_key)
  WHERE sucursal_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sapc_org ON public.sucursal_action_pin_config(organization_id);

ALTER TABLE public.sucursal_action_pin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM full access sapc"
  ON public.sucursal_action_pin_config FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'general_manager'))
  );

-- Manager view + edit per-sucursal overrides on assigned sucursales
CREATE POLICY "Manager manage assigned sapc"
  ON public.sucursal_action_pin_config FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(),'manager')
    AND sucursal_id IS NOT NULL
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(),'manager')
    AND sucursal_id IS NOT NULL
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- Manager / sucursal_account need to read general config to evaluate PIN gates
CREATE POLICY "Org members can view sapc"
  ON public.sucursal_action_pin_config FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE TRIGGER trg_sapc_updated_at
  BEFORE UPDATE ON public.sucursal_action_pin_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 4. Helper sucursal_action_requires_pin ----------
-- Resolution order: per-sucursal override > org general > default true (safe)
CREATE OR REPLACE FUNCTION public.sucursal_action_requires_pin(
  _organization_id uuid,
  _sucursal_id uuid,
  _action_key text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v boolean;
BEGIN
  -- per-sucursal override
  IF _sucursal_id IS NOT NULL THEN
    SELECT requires_pin INTO v
    FROM public.sucursal_action_pin_config
    WHERE organization_id = _organization_id
      AND sucursal_id = _sucursal_id
      AND action_key = _action_key
    LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;
  -- org general
  SELECT requires_pin INTO v
  FROM public.sucursal_action_pin_config
  WHERE organization_id = _organization_id
    AND sucursal_id IS NULL
    AND action_key = _action_key
  LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;

  -- defaults per action
  RETURN CASE _action_key
    WHEN 'cerrar_caja'           THEN true
    WHEN 'anular_transaccion'    THEN true
    WHEN 'registrar_gasto'       THEN false
    WHEN 'editar_gasto'          THEN true
    WHEN 'anular_gasto'          THEN true
    WHEN 'ver_sueldos'           THEN true
    WHEN 'registrar_pago_sueldo' THEN true
    WHEN 'crear_tarea'           THEN false
    WHEN 'editar_tarea'          THEN true
    WHEN 'completar_tarea'       THEN false
    WHEN 'bloquear_cliente'      THEN true
    WHEN 'ver_historial_caja'    THEN true
    ELSE true
  END;
END;
$$;

-- ---------- 5. Egresos: logical anulación columns ----------
ALTER TABLE public."Egresos"
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo','anulado')),
  ADD COLUMN IF NOT EXISTS anulado_at timestamptz,
  ADD COLUMN IF NOT EXISTS anulado_por uuid,
  ADD COLUMN IF NOT EXISTS anulado_por_pin_user_id uuid,
  ADD COLUMN IF NOT EXISTS anulado_motivo text;

CREATE INDEX IF NOT EXISTS idx_egresos_estado ON public."Egresos"(estado);

-- ---------- 6. handle_new_user: skip org creation for sucursal_account ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  new_sucursal_id UUID;
  org_name TEXT;
  org_slug TEXT;
  user_country TEXT;
  user_timezone TEXT;
  user_plan TEXT;
  invited_by_id UUID;
  is_sucursal_acc BOOLEAN;
BEGIN
  invited_by_id := (NEW.raw_user_meta_data->>'invited_by')::UUID;
  is_sucursal_acc := COALESCE((NEW.raw_user_meta_data->>'sucursal_account')::boolean, false);

  -- Sucursal accounts: edge function handles profile/role/user_sucursales rows.
  IF is_sucursal_acc THEN
    RETURN NEW;
  END IF;

  IF invited_by_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    RETURN NEW;
  END IF;

  org_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mi Barbería');
  org_slug := LOWER(REPLACE(org_name, ' ', '-')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);
  user_country := COALESCE(NEW.raw_user_meta_data->>'country', 'AR');

  user_plan := LOWER(COALESCE(NEW.raw_user_meta_data->>'business_plan', 'basico'));
  IF user_plan NOT IN ('basico','profesional','premium') THEN
    user_plan := 'basico';
  END IF;

  user_timezone := CASE user_country
    WHEN 'AR' THEN 'America/Argentina/Buenos_Aires'
    WHEN 'MX' THEN 'America/Mexico_City'
    WHEN 'CO' THEN 'America/Bogota'
    WHEN 'CL' THEN 'America/Santiago'
    WHEN 'PE' THEN 'America/Lima'
    WHEN 'EC' THEN 'America/Guayaquil'
    WHEN 'UY' THEN 'America/Montevideo'
    WHEN 'PY' THEN 'America/Asuncion'
    WHEN 'BO' THEN 'America/La_Paz'
    WHEN 'VE' THEN 'America/Caracas'
    WHEN 'ES' THEN 'Europe/Madrid'
    WHEN 'BR' THEN 'America/Sao_Paulo'
    WHEN 'CR' THEN 'America/Costa_Rica'
    WHEN 'PA' THEN 'America/Panama'
    WHEN 'DO' THEN 'America/Santo_Domingo'
    WHEN 'GT' THEN 'America/Guatemala'
    WHEN 'HN' THEN 'America/Tegucigalpa'
    WHEN 'SV' THEN 'America/El_Salvador'
    WHEN 'NI' THEN 'America/Managua'
    WHEN 'PR' THEN 'America/Puerto_Rico'
    WHEN 'CU' THEN 'America/Havana'
    ELSE 'America/Argentina/Buenos_Aires'
  END;

  INSERT INTO public.organizations (name, slug, plan, timezone, plan_expires_at, last_payment_at)
  VALUES (org_name, org_slug, user_plan, user_timezone, now() + interval '30 days', now())
  RETURNING id INTO new_org_id;

  INSERT INTO public.sucursales (organization_id, nombre, timezone)
  VALUES (new_org_id, 'Casa Central', user_timezone)
  RETURNING id INTO new_sucursal_id;

  INSERT INTO public.profiles (id, email, full_name, organization_id, default_sucursal_id)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), new_org_id, new_sucursal_id);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');

  INSERT INTO public.user_sucursales (user_id, sucursal_id, organization_id)
  VALUES (NEW.id, new_sucursal_id, new_org_id);

  RETURN NEW;
END;
$$;

-- =========================================================================
-- 7. RLS policies for sucursal_account on operational tables
-- =========================================================================
-- We deliberately do NOT touch admin tables (organizations, plan_features,
-- payment_methods_config, barberos write, comisiones, bono_fijo_*, etc.).
-- sucursal_account access is scoped to its own sucursal via get_user_sucursal_ids.
-- =========================================================================

-- ---- venta ----
CREATE POLICY "Sucursal account view venta"
  ON public.venta FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

CREATE POLICY "Sucursal account insert venta"
  ON public.venta FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

CREATE POLICY "Sucursal account update venta"
  ON public.venta FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- ---- venta_pagos ----
CREATE POLICY "Sucursal account access venta_pagos"
  ON public.venta_pagos FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- ---- venta_producto ----
CREATE POLICY "Sucursal account access venta_producto"
  ON public.venta_producto FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- ---- venta_extra (no org/sucursal columns; scope via venta) ----
CREATE POLICY "Sucursal account access venta_extra"
  ON public.venta_extra FOR ALL TO authenticated
  USING (
    public.is_sucursal_account(auth.uid())
    AND venta_id IN (
      SELECT v.id FROM public.venta v
      WHERE v.organization_id = public.get_user_organization_id(auth.uid())
        AND v.sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
    )
  )
  WITH CHECK (
    public.is_sucursal_account(auth.uid())
    AND venta_id IN (
      SELECT v.id FROM public.venta v
      WHERE v.organization_id = public.get_user_organization_id(auth.uid())
        AND v.sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
    )
  );

-- ---- turnos ----
CREATE POLICY "Sucursal account access turnos"
  ON public.turnos FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- ---- clientes (via clientes_sucursales link) ----
CREATE POLICY "Sucursal account view clientes"
  ON public.clientes FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clientes_sucursales cs
      WHERE cs.cliente_id = clientes.id
        AND cs.sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
    )
  );

CREATE POLICY "Sucursal account insert clientes"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
  );

CREATE POLICY "Sucursal account update clientes"
  ON public.clientes FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clientes_sucursales cs
      WHERE cs.cliente_id = clientes.id
        AND cs.sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
    )
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
  );

-- ---- clientes_sucursales ----
CREATE POLICY "Sucursal account access clientes_sucursales"
  ON public.clientes_sucursales FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- ---- tareas (operational on own sucursal) ----
CREATE POLICY "Sucursal account view tareas"
  ON public.tareas FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid())))
  );

CREATE POLICY "Sucursal account insert tareas"
  ON public.tareas FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

CREATE POLICY "Sucursal account update tareas"
  ON public.tareas FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid())))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
  );

-- ---- ingresos ----
CREATE POLICY "Sucursal account view ingresos"
  ON public.ingresos FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

CREATE POLICY "Sucursal account insert ingresos"
  ON public.ingresos FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

CREATE POLICY "Sucursal account update ingresos"
  ON public.ingresos FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- ---- ingresos_items ----
CREATE POLICY "Sucursal account access ingresos_items"
  ON public.ingresos_items FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid())))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
  );

-- ---- ingresos_items_productos ----
CREATE POLICY "Sucursal account access iip"
  ON public.ingresos_items_productos FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid())))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
  );

-- ---- Egresos: SELECT, INSERT, UPDATE only (no DELETE -> logical anulación) ----
CREATE POLICY "Sucursal account view Egresos"
  ON public."Egresos" FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

CREATE POLICY "Sucursal account insert Egresos"
  ON public."Egresos" FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
    AND estado = 'activo'
  );

CREATE POLICY "Sucursal account update Egresos"
  ON public."Egresos" FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- ---- pagos_sueldos: SELECT and INSERT only ----
CREATE POLICY "Sucursal account view pagos_sueldos"
  ON public.pagos_sueldos FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid())))
  );

CREATE POLICY "Sucursal account insert pagos_sueldos"
  ON public.pagos_sueldos FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- ---- anulaciones_cierre ----
CREATE POLICY "Sucursal account view anulaciones_cierre"
  ON public.anulaciones_cierre FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
  );

CREATE POLICY "Sucursal account insert anulaciones_cierre"
  ON public.anulaciones_cierre FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
  );

-- ---- Read-only catalog tables sucursal account needs to operate ----
-- sucursales (own only)
CREATE POLICY "Sucursal account view own sucursal"
  ON public.sucursales FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- barberos (read only on own sucursal so cobrar/turnos can list barbers)
CREATE POLICY "Sucursal account view sucursal barberos"
  ON public.barberos FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid())))
  );

-- agenda_config (read)
CREATE POLICY "Sucursal account view agenda_config"
  ON public.agenda_config FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- horarios_trabajo (read)
CREATE POLICY "Sucursal account view horarios_trabajo"
  ON public.horarios_trabajo FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- bloqueos_agenda (read)
CREATE POLICY "Sucursal account view bloqueos_agenda"
  ON public.bloqueos_agenda FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- gastos_recurrentes (read so they can apply them)
CREATE POLICY "Sucursal account view gastos_recurrentes"
  ON public.gastos_recurrentes FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_sucursal_account(auth.uid())
    AND (sucursal_id IS NULL OR sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid())))
  );
