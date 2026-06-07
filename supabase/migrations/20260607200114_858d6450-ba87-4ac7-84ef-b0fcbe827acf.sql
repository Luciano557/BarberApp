CREATE OR REPLACE FUNCTION public._notif_sucursal_barbers(_org uuid, _sucursal uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id
  FROM public.profiles p
  JOIN public.barberos b ON b.id = p.barbero_id
  JOIN public.barberos_sucursales bs ON bs.barbero_id = b.id
  WHERE p.organization_id = _org
    AND b.activo = true
    AND bs.organization_id = _org
    AND bs.sucursal_id = _sucursal
    AND bs.disponible = true
$function$;