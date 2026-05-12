CREATE OR REPLACE FUNCTION public.sucursal_action_requires_pin(_organization_id uuid, _sucursal_id uuid, _action_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v boolean;
BEGIN
  IF _sucursal_id IS NOT NULL THEN
    SELECT requires_pin INTO v
    FROM public.sucursal_action_pin_config
    WHERE organization_id = _organization_id
      AND sucursal_id = _sucursal_id
      AND action_key = _action_key
    LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;
  SELECT requires_pin INTO v
  FROM public.sucursal_action_pin_config
  WHERE organization_id = _organization_id
    AND sucursal_id IS NULL
    AND action_key = _action_key
  LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;

  RETURN CASE _action_key
    WHEN 'cerrar_caja'             THEN true
    WHEN 'anular_transaccion'      THEN true
    WHEN 'anular_cierre_caja'      THEN true
    WHEN 'regularizar_cierre_caja' THEN true
    WHEN 'registrar_gasto'         THEN false
    WHEN 'editar_gasto'            THEN true
    WHEN 'anular_gasto'            THEN true
    WHEN 'ver_gastos'              THEN true
    WHEN 'ver_sueldos'             THEN true
    WHEN 'registrar_pago_sueldo'   THEN true
    WHEN 'crear_tarea'             THEN false
    WHEN 'editar_tarea'            THEN true
    WHEN 'completar_tarea'         THEN false
    WHEN 'bloquear_cliente'        THEN true
    WHEN 'ver_historial_caja'      THEN true
    ELSE true
  END;
END;
$function$;