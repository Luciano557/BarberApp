
-- =========================================================================
-- Fase 5 · Bloque A: trigger de notificación "barbero_removido_sucursal"
-- =========================================================================
CREATE OR REPLACE FUNCTION public.trg_barberos_sucursales_after_disponible_off_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _org uuid := NEW.organization_id;
  _suc_perdida uuid := NEW.sucursal_id;
  _barbero_id uuid := NEW.barbero_id;
  _actor uuid := auth.uid();
  _actor_name text;
  _barbero_name text;
  _suc_perdida_nombre text;
  _suc_ganada_id uuid;
  _suc_ganada_nombre text;
  _recipients uuid[];
  _title text;
  _summary text;
BEGIN
  -- Nombre del actor (puede ser NULL si proviene de cron/service role).
  _actor_name := public._notif_actor_name(_actor);

  -- Nombre del barbero (de la misma org).
  SELECT TRIM(BOTH FROM (COALESCE(nombre,'') || ' ' || COALESCE(apellido,'')))
    INTO _barbero_name
  FROM public.barberos
  WHERE id = _barbero_id AND organization_id = _org;

  -- Nombre de la sucursal perdida.
  SELECT nombre INTO _suc_perdida_nombre
  FROM public.sucursales
  WHERE id = _suc_perdida AND organization_id = _org;

  -- Best-effort: sucursal "ganada" = otra fila disponible=true del mismo barbero.
  SELECT bs.sucursal_id, s.nombre
    INTO _suc_ganada_id, _suc_ganada_nombre
  FROM public.barberos_sucursales bs
  LEFT JOIN public.sucursales s
    ON s.id = bs.sucursal_id AND s.organization_id = _org
  WHERE bs.organization_id = _org
    AND bs.barbero_id = _barbero_id
    AND bs.sucursal_id <> _suc_perdida
    AND bs.disponible = true
  ORDER BY bs.updated_at DESC
  LIMIT 1;

  -- Destinatarios: admins de la org ∪ managers de la sucursal perdida, sin el actor ni el barbero.
  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(_org) AS user_id
    UNION
    SELECT user_id FROM public._notif_sucursal_managers(_org, _suc_perdida) AS user_id
      WHERE _suc_perdida IS NOT NULL
  ) s
  WHERE u IS NOT NULL
    AND (_actor IS NULL OR u <> _actor)
    AND u <> _barbero_id;

  IF _recipients IS NULL OR array_length(_recipients, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Texto.
  IF _suc_ganada_nombre IS NOT NULL THEN
    _title := COALESCE(_actor_name, 'Alguien')
              || ' habilitó a ' || COALESCE(_barbero_name, 'un barbero')
              || ' en ' || _suc_ganada_nombre
              || ' y lo deshabilitó en ' || COALESCE(_suc_perdida_nombre, 'la sucursal anterior') || '.';
  ELSE
    _title := COALESCE(_barbero_name, 'Un barbero')
              || ' fue deshabilitado en ' || COALESCE(_suc_perdida_nombre, 'la sucursal') || '.';
  END IF;
  _summary := COALESCE(_barbero_name, 'Barbero') || ' · ' || COALESCE(_suc_perdida_nombre, 'sucursal');

  PERFORM public._notif_emit(
    _org,
    'barbero_removido_sucursal',
    'barbero_removido_sucursal:' || NEW.id::text || ':' || extract(epoch from now())::bigint::text,
    _suc_perdida,
    'equipo',
    'barberos_sucursales',
    NEW.id,
    _title,
    NULL,
    _summary,
    'sistema_seguridad',
    jsonb_build_object(
      'barbero_id', _barbero_id,
      'barbero_nombre', _barbero_name,
      'sucursal_perdida_id', _suc_perdida,
      'sucursal_perdida_nombre', _suc_perdida_nombre,
      'sucursal_ganada_id', _suc_ganada_id,
      'sucursal_ganada_nombre', _suc_ganada_nombre,
      'actor_user_id', _actor
    ),
    _actor,
    _actor_name,
    _recipients,
    true
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bs_after_disponible_off_notif ON public.barberos_sucursales;
CREATE TRIGGER trg_bs_after_disponible_off_notif
AFTER UPDATE OF disponible ON public.barberos_sucursales
FOR EACH ROW
WHEN (OLD.disponible = true AND NEW.disponible = false)
EXECUTE FUNCTION public.trg_barberos_sucursales_after_disponible_off_notif();

-- =========================================================================
-- Fase 5 · Bloque B: habilitar Realtime en barberos_sucursales
-- =========================================================================
ALTER TABLE public.barberos_sucursales REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'barberos_sucursales'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.barberos_sucursales';
  END IF;
END$$;
