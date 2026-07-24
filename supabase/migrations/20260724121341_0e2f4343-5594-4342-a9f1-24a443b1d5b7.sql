
CREATE OR REPLACE FUNCTION public.notif_emit_crm_sync_fallo(
  _organization_id uuid,
  _sucursal_id uuid,
  _turno_id uuid,
  _title text,
  _body text,
  _metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _recipients uuid[];
BEGIN
  SELECT array_agg(DISTINCT u) INTO _recipients FROM (
    SELECT user_id AS u FROM public._notif_org_admins(_organization_id) AS user_id
    UNION SELECT user_id FROM public._notif_sucursal_managers(_organization_id, _sucursal_id) AS user_id
    UNION SELECT user_id FROM public._notif_sucursal_account(_organization_id, _sucursal_id) AS user_id
  ) g;

  IF _recipients IS NULL OR array_length(_recipients, 1) IS NULL THEN
    RETURN;
  END IF;

  PERFORM public._notif_emit(
    _organization_id,
    'crm_sync_fallo',
    'crm_sync_fallo:' || _turno_id::text,
    _sucursal_id,
    'agenda',
    'turnos',
    _turno_id,
    _title,
    _body,
    NULL,
    'sistema_seguridad',
    COALESCE(_metadata, '{}'::jsonb),
    NULL,
    NULL,
    _recipients,
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notif_emit_crm_sync_fallo(uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_emit_crm_sync_fallo(uuid, uuid, uuid, text, text, jsonb) TO service_role;
