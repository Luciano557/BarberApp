DO $$
DECLARE r record; cnt int := 0; msg text := '';
BEGIN
  FOR r IN
    SELECT organization_id, sucursal_id, count(*) c
    FROM public.barberos
    WHERE activo = true
      AND (rol_equipo = 'manager' OR roles_equipo @> ARRAY['manager']::text[])
    GROUP BY organization_id, sucursal_id
    HAVING count(*) > 1
  LOOP
    cnt := cnt + 1;
    msg := msg || format(E'\n  org=%s sucursal=%s managers_activos=%s', r.organization_id, r.sucursal_id, r.c);
    RAISE NOTICE 'DUPLICADO org=% sucursal=% managers_activos=%', r.organization_id, r.sucursal_id, r.c;
  END LOOP;
  IF cnt > 0 THEN
    RAISE EXCEPTION 'No se puede crear uniq_active_manager_per_sucursal: % sucursales con managers duplicados:%', cnt, msg;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_manager_per_sucursal
ON public.barberos (organization_id, sucursal_id)
WHERE activo = true
  AND (rol_equipo = 'manager' OR roles_equipo @> ARRAY['manager']::text[]);