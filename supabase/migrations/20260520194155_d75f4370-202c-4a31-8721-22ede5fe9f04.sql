
CREATE TABLE public._backup_phones_remove_ar9_20260520 AS
SELECT 'clientes'::text AS src, id::text AS record_id, organization_id, 'telefono'::text AS column_name,
       telefono AS old_value, regexp_replace(telefono, '^\+549', '+54') AS new_value, now() AS backed_up_at
FROM public.clientes WHERE telefono LIKE '+549%'
UNION ALL
SELECT 'turnos', id::text, organization_id, 'cliente_telefono',
       cliente_telefono, regexp_replace(cliente_telefono, '^\+549', '+54'), now()
FROM public.turnos WHERE cliente_telefono LIKE '+549%'
UNION ALL
SELECT 'barberos', id::text, organization_id, 'telefono',
       telefono, regexp_replace(telefono, '^\+549', '+54'), now()
FROM public.barberos WHERE telefono LIKE '+549%'
UNION ALL
SELECT 'sucursales', id::text, organization_id, 'telefono',
       telefono, regexp_replace(telefono, '^\+549', '+54'), now()
FROM public.sucursales WHERE telefono LIKE '+549%';

UPDATE public.clientes   SET telefono = regexp_replace(telefono, '^\+549', '+54') WHERE telefono LIKE '+549%';
UPDATE public.turnos     SET cliente_telefono = regexp_replace(cliente_telefono, '^\+549', '+54') WHERE cliente_telefono LIKE '+549%';
UPDATE public.barberos   SET telefono = regexp_replace(telefono, '^\+549', '+54') WHERE telefono LIKE '+549%';
UPDATE public.sucursales SET telefono = regexp_replace(telefono, '^\+549', '+54') WHERE telefono LIKE '+549%';
