CREATE OR REPLACE FUNCTION public.reorder_lineas(p_org_id uuid, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org uuid;
  v_count int;
BEGIN
  -- 1) Validar pertenencia del caller a la organización (mismo patrón que RLS del proyecto)
  v_caller_org := public.get_user_organization_id(auth.uid());
  IF v_caller_org IS NULL OR v_caller_org <> p_org_id THEN
    RAISE EXCEPTION 'No autorizado: el usuario no pertenece a la organización indicada.'
      USING ERRCODE = '42501';
  END IF;

  -- 2) Validar que TODOS los ids pasados pertenezcan a esa organización
  SELECT count(*) INTO v_count
  FROM public.lineas
  WHERE id = ANY(p_ids) AND organization_id = p_org_id;

  IF v_count <> array_length(p_ids, 1) THEN
    RAISE EXCEPTION 'Ids inválidos: alguna línea no pertenece a la organización %.', p_org_id
      USING ERRCODE = '42501';
  END IF;

  -- 3) Reasignar orden en múltiplos de 10, atómico.
  --    El WHERE con organization_id es defensa en profundidad: incluso si llegara
  --    un id de otra org, jamás se actualizaría una fila ajena.
  UPDATE public.lineas
  SET orden = (t.idx)::int * 10
  FROM unnest(p_ids) WITH ORDINALITY AS t(id, idx)
  WHERE public.lineas.id = t.id
    AND public.lineas.organization_id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_lineas(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_lineas(uuid, uuid[]) TO authenticated;