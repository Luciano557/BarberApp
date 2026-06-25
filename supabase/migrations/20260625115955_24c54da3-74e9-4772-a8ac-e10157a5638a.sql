ALTER TABLE public.servicios ADD COLUMN descripcion text;

ALTER TABLE public.lineas ADD COLUMN descripcion text;

ALTER TABLE public.lineas ADD COLUMN orden integer;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY lower(nombre) ASC, id ASC) AS rn
  FROM public.lineas
)
UPDATE public.lineas l
SET orden = r.rn * 10
FROM ranked r
WHERE l.id = r.id;

ALTER TABLE public.lineas ALTER COLUMN orden SET DEFAULT 0;
ALTER TABLE public.lineas ALTER COLUMN orden SET NOT NULL;

CREATE INDEX IF NOT EXISTS lineas_org_orden_idx ON public.lineas (organization_id, orden);