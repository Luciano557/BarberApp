
-- Enable btree_gist for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add duracion_min to servicios
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS duracion_min integer NOT NULL DEFAULT 30;

-- =============================================
-- 1. agenda_config
-- =============================================
CREATE TABLE agenda_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  duracion_base_min integer NOT NULL DEFAULT 15,
  buffer_antes_min integer NOT NULL DEFAULT 0,
  buffer_despues_min integer NOT NULL DEFAULT 5,
  dias_anticipacion integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, sucursal_id)
);

ALTER TABLE agenda_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access agenda_config"
  ON agenda_config FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Barber can view sucursal agenda_config"
  ON agenda_config FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber'::app_role)
    AND sucursal_id IN (SELECT get_user_sucursal_ids(auth.uid()))
  );

-- =============================================
-- 2. horarios_trabajo
-- =============================================
CREATE TABLE horarios_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  barbero_id uuid NOT NULL REFERENCES barberos(id) ON DELETE CASCADE,
  dia_semana integer NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (hora_fin > hora_inicio)
);

ALTER TABLE horarios_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access horarios_trabajo"
  ON horarios_trabajo FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Barber can view own horarios_trabajo"
  ON horarios_trabajo FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber'::app_role)
    AND barbero_id = get_user_barbero_id(auth.uid())
  );

-- =============================================
-- 3. bloqueos_agenda
-- =============================================
CREATE TABLE bloqueos_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  barbero_id uuid REFERENCES barberos(id) ON DELETE CASCADE,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  hora_inicio time,
  hora_fin time,
  motivo text,
  todo_el_dia boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

ALTER TABLE bloqueos_agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access bloqueos_agenda"
  ON bloqueos_agenda FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Barber can view own and branch bloqueos_agenda"
  ON bloqueos_agenda FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber'::app_role)
    AND (
      barbero_id = get_user_barbero_id(auth.uid())
      OR (barbero_id IS NULL AND sucursal_id IN (SELECT get_user_sucursal_ids(auth.uid())))
    )
  );

-- =============================================
-- 4. turnos
-- =============================================
CREATE TABLE turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  barbero_id uuid NOT NULL REFERENCES barberos(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id),
  cliente_nombre text,
  cliente_telefono text,
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'en_curso', 'completado', 'cancelado', 'no_asistio')),
  notas text,
  rango_horario tstzrange,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (hora_fin > hora_inicio)
);

-- Trigger function to compute rango_horario from fecha + hora + timezone
CREATE OR REPLACE FUNCTION compute_rango_horario()
RETURNS trigger
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.rango_horario := tstzrange(
    ((NEW.fecha || ' ' || NEW.hora_inicio)::timestamp AT TIME ZONE NEW.timezone),
    ((NEW.fecha || ' ' || NEW.hora_fin)::timestamp AT TIME ZONE NEW.timezone),
    '[)'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_rango_horario
  BEFORE INSERT OR UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION compute_rango_horario();

-- Exclusion constraint: no overlapping active appointments per barbero+sucursal
ALTER TABLE turnos ADD CONSTRAINT no_overlap_turnos
  EXCLUDE USING gist (
    sucursal_id WITH =,
    barbero_id WITH =,
    rango_horario WITH &&
  ) WHERE (estado IN ('pendiente', 'confirmado', 'en_curso'));

CREATE INDEX idx_turnos_fecha_sucursal ON turnos(sucursal_id, fecha);
CREATE INDEX idx_turnos_barbero_fecha ON turnos(barbero_id, fecha);

ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access turnos"
  ON turnos FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Barber can view own turnos"
  ON turnos FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'barber'::app_role)
    AND barbero_id = get_user_barbero_id(auth.uid())
  );

-- Triggers for updated_at
CREATE TRIGGER update_agenda_config_updated_at BEFORE UPDATE ON agenda_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_horarios_trabajo_updated_at BEFORE UPDATE ON horarios_trabajo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_turnos_updated_at BEFORE UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
