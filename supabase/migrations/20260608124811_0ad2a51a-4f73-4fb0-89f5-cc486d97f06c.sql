ALTER TABLE public.barberos DISABLE TRIGGER trg_barberos_protect_owner_row_del;

UPDATE public.barberos
SET rol_equipo = 'owner',
    roles_equipo = ARRAY(SELECT DISTINCT unnest(COALESCE(roles_equipo, ARRAY[]::text[]) || ARRAY['owner']))
WHERE id = '5883955a-591b-4c18-9a6c-5f2bd6a86ac9';

DELETE FROM public.barberos WHERE id = 'be36315b-c4fd-44fd-8614-321f67f4866c';

UPDATE public.barberos
SET rol_equipo = 'owner',
    roles_equipo = ARRAY(SELECT DISTINCT unnest(COALESCE(roles_equipo, ARRAY[]::text[]) || ARRAY['owner']))
WHERE id = 'cbb3c3cc-6738-4c03-84bc-80d91fafa85a';

UPDATE public.profiles
SET barbero_id = 'cbb3c3cc-6738-4c03-84bc-80d91fafa85a'
WHERE id = '1cf92fc3-491a-4430-b4f6-efd940d93866';

DELETE FROM public.barberos WHERE id = '4daaf024-6689-4f2e-9787-4606c4986ae9';

ALTER TABLE public.barberos ENABLE TRIGGER trg_barberos_protect_owner_row_del;