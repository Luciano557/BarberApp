
-- 1) BACKUP
CREATE TABLE IF NOT EXISTS public._backup_phones_20260520 AS
SELECT 'clientes'::text AS src, id::text AS record_id, organization_id, telefono AS old_value, now() AS backed_up_at
FROM public.clientes WHERE telefono IS NOT NULL
UNION ALL
SELECT 'turnos', id::text, organization_id, cliente_telefono, now()
FROM public.turnos WHERE cliente_telefono IS NOT NULL
UNION ALL
SELECT 'barberos', id::text, organization_id, telefono, now()
FROM public.barberos WHERE telefono IS NOT NULL;

-- 2) FUNCIÓN CANÓNICA AR (idempotente, corregida: sin la regla 0+area+8)
CREATE OR REPLACE FUNCTION public._canon_phone_ar(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d text;
  l int;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(input, '\D', '', 'g');
  IF d IS NULL OR length(d) = 0 THEN RETURN NULL; END IF;
  l := length(d);

  IF l = 13 AND left(d,3) = '549' THEN
    RETURN '+' || d;
  END IF;

  IF l = 12 AND left(d,2) = '54' AND substr(d,3,1) IN ('1','2','3') THEN
    RETURN '+549' || substr(d, 3);
  END IF;

  IF l = 10 AND left(d,1) IN ('1','2','3') THEN
    RETURN '+549' || d;
  END IF;

  -- Solo el viejo 011 15 + 8 (móvil); 011 sin 15 NO se convierte (posible fijo)
  IF l = 13 AND left(d,5) = '01115' THEN
    RETURN '+54911' || substr(d, 6);
  END IF;

  RETURN NULL;
END;
$$;

-- 3) CLIENTES (convertibles)
UPDATE public.clientes
SET telefono = public._canon_phone_ar(telefono)
WHERE telefono IS NOT NULL
  AND public._canon_phone_ar(telefono) IS NOT NULL
  AND telefono <> public._canon_phone_ar(telefono);

-- 4) TURNOS (convertibles + limpiar basura)
UPDATE public.turnos
SET cliente_telefono = public._canon_phone_ar(cliente_telefono)
WHERE cliente_telefono IS NOT NULL
  AND public._canon_phone_ar(cliente_telefono) IS NOT NULL
  AND cliente_telefono <> public._canon_phone_ar(cliente_telefono);

UPDATE public.turnos
SET cliente_telefono = NULL
WHERE cliente_telefono IS NOT NULL
  AND public._canon_phone_ar(cliente_telefono) IS NULL;

-- 5) BARBEROS (convertibles + limpiar no convertibles a NULL)
UPDATE public.barberos
SET telefono = public._canon_phone_ar(telefono)
WHERE telefono IS NOT NULL
  AND public._canon_phone_ar(telefono) IS NOT NULL
  AND telefono <> public._canon_phone_ar(telefono);

UPDATE public.barberos
SET telefono = NULL
WHERE telefono IS NOT NULL
  AND public._canon_phone_ar(telefono) IS NULL;

-- 6) REPORTE DE MIGRACIÓN / NO MIGRADOS
CREATE OR REPLACE VIEW public._phone_migration_report AS
SELECT
  b.src AS tabla,
  b.record_id,
  b.organization_id,
  b.old_value AS valor_original,
  public._canon_phone_ar(b.old_value) AS valor_canonico,
  CASE
    WHEN public._canon_phone_ar(b.old_value) IS NOT NULL THEN 'migrado'
    WHEN b.src = 'clientes' THEN 'no_migrado_preservado'
    ELSE 'limpiado_a_null'
  END AS accion,
  CASE
    WHEN public._canon_phone_ar(b.old_value) IS NOT NULL THEN 'convertible_a_+549'
    WHEN length(regexp_replace(coalesce(b.old_value,''),'\D','','g')) < 8 THEN 'invalido_o_basura'
    WHEN b.old_value ~* '^\+?(44|39|34|55|56|57|58|51|52|598|595|591|1\s)' THEN 'posible_extranjero'
    WHEN regexp_replace(coalesce(b.old_value,''),'\D','','g') ~ '^0?11[^15]' THEN 'posible_fijo_011'
    ELSE 'ambiguo'
  END AS motivo
FROM public._backup_phones_20260520 b;

-- 7) REPORTE DE DUPLICADOS POST-MIGRACIÓN
CREATE OR REPLACE VIEW public._phone_dups_report AS
SELECT
  organization_id,
  telefono,
  count(*) AS cantidad,
  array_agg(id) AS cliente_ids
FROM public.clientes
WHERE eliminado = false AND telefono IS NOT NULL
GROUP BY organization_id, telefono
HAVING count(*) > 1;
