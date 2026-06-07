
-- FASE 3.5 — Migración 1: esquema temporal/recurrente en barberos_sucursales

ALTER TABLE public.barberos_sucursales
  ADD COLUMN tipo text NOT NULL DEFAULT 'principal',
  ADD COLUMN fecha_inicio date NULL,
  ADD COLUMN fecha_fin    date NULL,
  ADD COLUMN dias_semana  smallint[] NULL;

ALTER TABLE public.barberos_sucursales
  ADD CONSTRAINT bs_tipo_check
  CHECK (tipo IN ('principal','temporal','recurrente'));

ALTER TABLE public.barberos_sucursales
  ADD CONSTRAINT bs_principal_shape_check CHECK (
    tipo <> 'principal'
    OR (fecha_inicio IS NULL AND fecha_fin IS NULL AND dias_semana IS NULL)
  );

ALTER TABLE public.barberos_sucursales
  ADD CONSTRAINT bs_temporal_shape_check CHECK (
    tipo <> 'temporal'
    OR (fecha_fin IS NOT NULL
        AND dias_semana IS NULL
        AND (fecha_inicio IS NULL OR fecha_inicio <= fecha_fin))
  );

ALTER TABLE public.barberos_sucursales
  ADD CONSTRAINT bs_recurrente_shape_check CHECK (
    tipo <> 'recurrente'
    OR (dias_semana IS NOT NULL
        AND array_length(dias_semana, 1) BETWEEN 1 AND 7
        AND dias_semana <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
        AND (fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_inicio <= fecha_fin))
  );

CREATE INDEX idx_bs_tipo_fechas
  ON public.barberos_sucursales (tipo, fecha_inicio, fecha_fin)
  WHERE tipo IN ('temporal','recurrente');

-- Ajuste: autocreate explicita tipo='principal'
CREATE OR REPLACE FUNCTION public.bs_autocreate_on_barbero_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    (organization_id, barbero_id, sucursal_id, disponible, tipo)
  VALUES
    (NEW.organization_id, NEW.id, NEW.sucursal_id, true, 'principal')
  ON CONFLICT (barbero_id, sucursal_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
