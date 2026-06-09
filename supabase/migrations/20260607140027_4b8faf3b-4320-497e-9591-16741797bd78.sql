-- ============================================================================
-- FASE 1: Capa de disponibilidad barbero ↔ sucursal
-- Aditiva. No toca barberos.sucursal_id, barberos_safe, ni RLS de barberos.
-- ============================================================================

-- ---------- 1. Tabla ----------
CREATE TABLE public.barberos_sucursales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  barbero_id uuid NOT NULL REFERENCES public.barberos(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  disponible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uniq_barbero_sucursal UNIQUE (barbero_id, sucursal_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.barberos_sucursales TO authenticated;
GRANT ALL ON public.barberos_sucursales TO service_role;

-- ---------- 2. Índices ----------
CREATE INDEX idx_bs_sucursal ON public.barberos_sucursales (sucursal_id);
CREATE INDEX idx_bs_barbero  ON public.barberos_sucursales (barbero_id);
CREATE INDEX idx_bs_org      ON public.barberos_sucursales (organization_id);

-- Invariante físico: máximo una fila disponible=true por barbero
CREATE UNIQUE INDEX uniq_barbero_disponible_true
  ON public.barberos_sucursales (barbero_id)
  WHERE disponible = true;

-- ---------- 3. Trigger updated_at ----------
CREATE TRIGGER update_barberos_sucursales_updated_at
  BEFORE UPDATE ON public.barberos_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 4. Trigger: consistencia de organización ----------
CREATE OR REPLACE FUNCTION public.bs_validate_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b_org uuid;
  s_org uuid;
BEGIN
  SELECT organization_id INTO b_org FROM public.barberos    WHERE id = NEW.barbero_id;
  SELECT organization_id INTO s_org FROM public.sucursales  WHERE id = NEW.sucursal_id;
  IF b_org IS NULL OR s_org IS NULL THEN
    RAISE EXCEPTION 'barbero o sucursal inexistente';
  END IF;
  IF b_org <> NEW.organization_id OR s_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'organization_id inconsistente entre barbero, sucursal y barberos_sucursales';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bs_validate_org_consistency_trg
  BEFORE INSERT OR UPDATE ON public.barberos_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.bs_validate_org_consistency();

-- ---------- 5. Trigger: uno disponible a la vez (apaga las demás) ----------
-- SECURITY DEFINER + filtro estricto por barbero_id y organization_id.
CREATE OR REPLACE FUNCTION public.bs_ensure_single_disponible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.disponible = true THEN
    UPDATE public.barberos_sucursales
       SET disponible = false,
           updated_at = now(),
           updated_by = auth.uid()
     WHERE barbero_id = NEW.barbero_id
       AND organization_id = NEW.organization_id
       AND id <> NEW.id
       AND disponible = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bs_ensure_single_disponible_trg
  BEFORE INSERT OR UPDATE OF disponible ON public.barberos_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.bs_ensure_single_disponible();

-- ---------- 6. Trigger: manager no puede mover asignación, solo `disponible` ----------
CREATE OR REPLACE FUNCTION public.bs_enforce_manager_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass para service_role / edge functions
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Owner / GM pueden modificar cualquier columna
  IF public.has_role(auth.uid(), 'owner'::app_role)
     OR public.has_role(auth.uid(), 'general_manager'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Resto (manager): solo puede tocar `disponible`
  IF NEW.barbero_id      <> OLD.barbero_id
     OR NEW.sucursal_id  <> OLD.sucursal_id
     OR NEW.organization_id <> OLD.organization_id THEN
    RAISE EXCEPTION 'Solo owner/general_manager pueden modificar la asignación (barbero/sucursal/organización)';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bs_enforce_manager_update_scope_trg
  BEFORE UPDATE ON public.barberos_sucursales
  FOR EACH ROW EXECUTE FUNCTION public.bs_enforce_manager_update_scope();

-- ---------- 7. RLS ----------
ALTER TABLE public.barberos_sucursales ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "Owner GM view org barberos_sucursales"
ON public.barberos_sucursales FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);

CREATE POLICY "Manager view scoped barberos_sucursales"
ON public.barberos_sucursales FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'manager'::app_role)
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

CREATE POLICY "Sucursal account view scoped barberos_sucursales"
ON public.barberos_sucursales FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.is_sucursal_account(auth.uid())
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

CREATE POLICY "Barber view own barberos_sucursales"
ON public.barberos_sucursales FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'barber'::app_role)
  AND barbero_id = public.get_user_barbero_id(auth.uid())
);

-- INSERT: solo owner/GM
CREATE POLICY "Owner GM insert barberos_sucursales"
ON public.barberos_sucursales FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);

-- DELETE: solo owner/GM
CREATE POLICY "Owner GM delete barberos_sucursales"
ON public.barberos_sucursales FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);

-- UPDATE: owner/GM (toda la org) + manager (sus sucursales).
-- El bloqueo column-level (manager solo `disponible`) lo enforce el trigger.
CREATE POLICY "Owner GM update barberos_sucursales"
ON public.barberos_sucursales FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);

CREATE POLICY "Manager update scoped barberos_sucursales"
ON public.barberos_sucursales FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'manager'::app_role)
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'manager'::app_role)
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

-- ---------- 8. Trigger altas futuras: AFTER INSERT ON barberos ----------
-- Crea fila de disponibilidad SOLO si el integrante es realmente barbero
-- (rol_equipo = 'barbero' o roles_equipo contiene 'barber') y tiene sucursal_id.
-- La unificación fina del criterio se hará en Fase 2.
CREATE OR REPLACE FUNCTION public.bs_autocreate_on_barbero_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  es_barbero boolean;
BEGIN
  IF NEW.sucursal_id IS NULL THEN
    RETURN NEW;
  END IF;

  es_barbero :=
    COALESCE(lower(NEW.rol_equipo) = 'barbero', false)
    OR (NEW.roles_equipo IS NOT NULL AND 'barber' = ANY(NEW.roles_equipo));

  IF NOT es_barbero THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.barberos_sucursales
    (organization_id, barbero_id, sucursal_id, disponible)
  VALUES
    (NEW.organization_id, NEW.id, NEW.sucursal_id, true)
  ON CONFLICT (barbero_id, sucursal_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bs_autocreate_on_barbero_insert_trg
  AFTER INSERT ON public.barberos
  FOR EACH ROW EXECUTE FUNCTION public.bs_autocreate_on_barbero_insert();

-- ---------- 9. Backfill ----------
-- 22 filas esperadas (los 23 barberos menos el de sucursal_id NULL).
INSERT INTO public.barberos_sucursales
  (organization_id, barbero_id, sucursal_id, disponible)
SELECT b.organization_id, b.id, b.sucursal_id, true
FROM public.barberos b
WHERE b.sucursal_id IS NOT NULL
ON CONFLICT (barbero_id, sucursal_id) DO NOTHING;