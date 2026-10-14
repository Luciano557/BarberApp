-- =====================================================================================================
-- Etapa 3 · BUILD 3 · Paso 1 — Backup del alcance aprobado en el schema `etapa3_backup`.
-- Operación única sobre azqpyfoobpovqosbayvz. NO es una migración. NO borra ni modifica nada en public.
--
-- Crea, en una sola transacción (si algo falla no queda nada):
--   * las funciones de selección del alcance (única definición; las usan todos los pasos siguientes);
--   * copias COMPLETAS (SELECT *) de: tareas_recurrentes, tareas tipo admin/tarea, notifications de Tareas
--     (incluidas las huérfanas estructurales) y sus notification_deliveries / notification_reads;
--   * `manifest` (cantidades, checksums, desgloses y fotos de control) y `manifest_ids` (ids de control);
--   * las funciones de verificación, borrado, restauración y ensayo.
-- El schema queda sin acceso para PUBLIC, anon, authenticated y service_role (solo su dueño).
-- Aborta si `etapa3_backup` ya existe, si hay ambigüedades o si el backup no coincide con lo vivo.
-- =====================================================================================================
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL TimeZone = 'UTC';

-- Nadie escribe en Tareas mientras se copia (las lecturas siguen). Se libera al terminar la transacción.
LOCK TABLE public.tareas_recurrentes, public.tareas IN SHARE ROW EXCLUSIVE MODE;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'etapa3_backup') THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: el schema etapa3_backup ya existe. Inspeccionarlo; no se sobrescribe.';
  END IF;
END
$guard$;

CREATE SCHEMA etapa3_backup;
COMMENT ON SCHEMA etapa3_backup IS
  'Etapa 3 (reset pre-lanzamiento de Tareas): backup recuperable del alcance borrado. Sin acceso para roles cliente.';

-- -----------------------------------------------------------------------------------------------------
-- Alcance. Única definición.
-- -----------------------------------------------------------------------------------------------------
CREATE FUNCTION etapa3_backup.sel_tareas_recurrentes() RETURNS SETOF public.tareas_recurrentes
LANGUAGE sql STABLE SET search_path = '' AS $f$
  SELECT r.* FROM public.tareas_recurrentes r
$f$;

-- Peticiones (tipo 'peticion') quedan SIEMPRE fuera.
CREATE FUNCTION etapa3_backup.sel_tareas() RETURNS SETOF public.tareas
LANGUAGE sql STABLE SET search_path = '' AS $f$
  SELECT t.* FROM public.tareas t WHERE t.tipo IN ('admin', 'tarea')
$f$;

-- Notificaciones de Tareas, solo por columnas estructurales (módulo, tabla de origen, evento, id de origen).
-- Incluye huérfanas (el origen ya no existe). Nunca: peticion_*, otros módulos, ni un origen que hoy sea una
-- petición o de otra organización (esos casos se reportan como ambigüedad y abortan).
CREATE FUNCTION etapa3_backup.sel_notifications() RETURNS SETOF public.notifications
LANGUAGE sql STABLE SET search_path = '' AS $f$
  SELECT n.* FROM public.notifications n
   WHERE n.source_module = 'tareas'
     AND n.source_id IS NOT NULL
     AND ((n.source_table = 'tareas'
           AND n.type IN ('tarea_pendiente', 'tarea_asignada', 'tarea_equipo_asignada', 'tarea_vencida')
           AND NOT EXISTS (SELECT 1 FROM public.tareas t
                            WHERE t.id = n.source_id
                              AND (t.tipo NOT IN ('admin', 'tarea') OR t.organization_id <> n.organization_id)))
       OR (n.source_table = 'tareas_recurrentes'
           AND n.type = 'tarea_automatica_pausada'
           AND NOT EXISTS (SELECT 1 FROM public.tareas_recurrentes r
                            WHERE r.id = n.source_id AND r.organization_id <> n.organization_id)))
$f$;

CREATE FUNCTION etapa3_backup.sel_notification_deliveries() RETURNS SETOF public.notification_deliveries
LANGUAGE sql STABLE SET search_path = '' AS $f$
  SELECT d.* FROM public.notification_deliveries d
   WHERE d.notification_id IN (SELECT n.id FROM etapa3_backup.sel_notifications() n)
$f$;

CREATE FUNCTION etapa3_backup.sel_notification_reads() RETURNS SETOF public.notification_reads
LANGUAGE sql STABLE SET search_path = '' AS $f$
  SELECT r.* FROM public.notification_reads r
   WHERE r.notification_id IN (SELECT n.id FROM etapa3_backup.sel_notifications() n)
$f$;

-- Cualquier fila > 0 detiene el proceso: algo que no se puede clasificar sin adivinar.
CREATE FUNCTION etapa3_backup.ambiguedades() RETURNS TABLE (motivo text, cantidad bigint)
LANGUAGE sql STABLE SET search_path = '' AS $f$
  SELECT 'tareas con tipo fuera de admin/tarea/peticion', pg_catalog.count(*)
    FROM public.tareas t WHERE t.tipo IS NULL OR t.tipo NOT IN ('admin', 'tarea', 'peticion')
  UNION ALL
  SELECT 'notificaciones del módulo tareas sin clasificar (evento nuevo, tabla y evento no coinciden, sin origen, u origen que es una petición o de otra organización)',
         pg_catalog.count(*)
    FROM public.notifications n
   WHERE n.source_module = 'tareas' AND n.type NOT LIKE 'peticion\_%'
     AND NOT EXISTS (SELECT 1 FROM etapa3_backup.sel_notifications() s WHERE s.id = n.id)
  UNION ALL
  SELECT 'eventos de Tareas emitidos fuera del módulo tareas', pg_catalog.count(*)
    FROM public.notifications n
   WHERE n.source_module IS DISTINCT FROM 'tareas'
     AND n.type IN ('tarea_pendiente', 'tarea_asignada', 'tarea_equipo_asignada', 'tarea_vencida', 'tarea_automatica_pausada')
  UNION ALL
  SELECT 'notificaciones peticion_* cuyo origen es una tarea del alcance', pg_catalog.count(*)
    FROM public.notifications n
   WHERE n.type LIKE 'peticion\_%' AND n.source_table = 'tareas'
     AND EXISTS (SELECT 1 FROM public.tareas t WHERE t.id = n.source_id AND t.tipo IN ('admin', 'tarea'))
  UNION ALL
  SELECT 'lecturas sin notification_id que apuntan al alcance', pg_catalog.count(*)
    FROM public.notification_reads r
   WHERE r.notification_id IS NULL
     AND (EXISTS (SELECT 1 FROM public.tareas t WHERE t.id = r.source_id AND t.tipo IN ('admin', 'tarea'))
       OR EXISTS (SELECT 1 FROM public.tareas_recurrentes x WHERE x.id = r.source_id)
       OR EXISTS (SELECT 1 FROM etapa3_backup.sel_notifications() s WHERE s.id = r.source_id))
  UNION ALL
  SELECT 'entregas o lecturas del alcance con otra organización que su notificación', pg_catalog.count(*)
    FROM (SELECT d.notification_id, d.organization_id FROM etapa3_backup.sel_notification_deliveries() d
          UNION ALL
          SELECT r.notification_id, r.organization_id FROM etapa3_backup.sel_notification_reads() r) x
    JOIN public.notifications n ON n.id = x.notification_id
   WHERE n.organization_id <> x.organization_id
  UNION ALL
  SELECT 'tareas o Tareas automáticas del alcance con sucursal de otra organización', pg_catalog.count(*)
    FROM (SELECT t.organization_id, t.sucursal_id FROM etapa3_backup.sel_tareas() t
          UNION ALL
          SELECT r.organization_id, r.sucursal_id FROM etapa3_backup.sel_tareas_recurrentes() r) x
    JOIN public.sucursales s ON s.id = x.sucursal_id
   WHERE s.organization_id <> x.organization_id
  UNION ALL
  -- Solo las tres relaciones verificadas en el preflight, con su ON DELETE exacto.
  SELECT 'claves foráneas no previstas hacia las tablas del alcance', pg_catalog.count(*)
    FROM pg_catalog.pg_constraint c
   WHERE c.contype = 'f'
     AND c.confrelid IN ('public.tareas'::regclass, 'public.tareas_recurrentes'::regclass, 'public.notifications'::regclass,
                         'public.notification_deliveries'::regclass, 'public.notification_reads'::regclass)
     AND NOT ((c.conrelid = 'public.tareas'::regclass AND c.confrelid = 'public.tareas_recurrentes'::regclass AND c.confdeltype = 'n')
           OR (c.conrelid = 'public.notification_deliveries'::regclass AND c.confrelid = 'public.notifications'::regclass AND c.confdeltype = 'c')
           OR (c.conrelid = 'public.notification_reads'::regclass AND c.confrelid = 'public.notifications'::regclass AND c.confdeltype = 'c'))
  UNION ALL
  -- Borrar no debe disparar nada (ni notificaciones ni efectos): ningún trigger de DELETE/TRUNCATE.
  SELECT 'triggers de DELETE o TRUNCATE en las tablas del alcance', pg_catalog.count(*)
    FROM pg_catalog.pg_trigger g
   WHERE NOT g.tgisinternal
     AND g.tgrelid IN ('public.tareas'::regclass, 'public.tareas_recurrentes'::regclass, 'public.notifications'::regclass,
                       'public.notification_deliveries'::regclass, 'public.notification_reads'::regclass)
     AND (g.tgtype::integer & (8 | 32)) <> 0
$f$;

-- -----------------------------------------------------------------------------------------------------
-- Huellas deterministas: cantidad, md5 de las filas completas ordenadas por id y md5 del conjunto de ids.
-- -----------------------------------------------------------------------------------------------------
CREATE FUNCTION etapa3_backup.huella(p_consulta text, OUT cantidad bigint, OUT checksum text, OUT ids text)
LANGUAGE plpgsql STABLE SET search_path = '' SET timezone = 'UTC' SET datestyle = 'ISO, MDY' AS $f$
BEGIN
  EXECUTE pg_catalog.format(
    'SELECT pg_catalog.count(*)::bigint,
            pg_catalog.md5(COALESCE(pg_catalog.string_agg(x::text, %L ORDER BY x.id), %L)),
            pg_catalog.md5(COALESCE(pg_catalog.string_agg(x.id::text, %L ORDER BY x.id), %L))
       FROM (%s) x', E'\n', '', ',', '', p_consulta)
  INTO cantidad, checksum, ids;
END
$f$;

-- Organizaciones, barberos, sucursales y barberos_sucursales: solo conteo, ids y último updated_at.
CREATE FUNCTION etapa3_backup.foto_protegida() RETURNS TABLE (tabla text, cantidad bigint, ids text, max_updated_at text)
LANGUAGE plpgsql STABLE SET search_path = '' SET timezone = 'UTC' SET datestyle = 'ISO, MDY' AS $f$
BEGIN
  FOREACH tabla IN ARRAY ARRAY['organizations', 'barberos', 'sucursales', 'barberos_sucursales'] LOOP
    EXECUTE pg_catalog.format(
      'SELECT pg_catalog.count(*)::bigint,
              pg_catalog.md5(COALESCE(pg_catalog.string_agg(x.id::text, '','' ORDER BY x.id), '''')),
              pg_catalog.max(pg_catalog.to_jsonb(x) ->> ''updated_at'')
         FROM public.%I x', tabla)
    INTO cantidad, ids, max_updated_at;
    RETURN NEXT;
  END LOOP;
END
$f$;

-- Motor de la Etapa 2, grants y RLS del módulo: cada objeto con la huella de su definición.
CREATE FUNCTION etapa3_backup.foto_motor() RETURNS TABLE (objeto text, huella text)
LANGUAGE plpgsql STABLE SET search_path = '' AS $f$
BEGIN
  RETURN QUERY
    SELECT 'funcion ' || p.oid::regprocedure::text,
           pg_catalog.md5(p.prosrc || '|' || p.prosecdef::text || '|' || COALESCE(p.proconfig::text, '') || '|'
                          || COALESCE(p.proacl::text, '') || '|' || pg_catalog.pg_get_userbyid(p.proowner))
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND (p.proname LIKE '%tarea%' OR p.proname IN ('_notif_barbero_users', '_notif_emit'));
  RETURN QUERY
    SELECT 'trigger ' || g.tgrelid::regclass::text || '.' || g.tgname,
           pg_catalog.md5(pg_catalog.pg_get_triggerdef(g.oid) || '|' || g.tgenabled::text)
      FROM pg_catalog.pg_trigger g JOIN pg_catalog.pg_proc p ON p.oid = g.tgfoid
     WHERE NOT g.tgisinternal
       AND (g.tgrelid IN ('public.tareas'::regclass, 'public.tareas_recurrentes'::regclass) OR p.proname LIKE '%tarea%');
  RETURN QUERY
    SELECT 'tabla ' || c.oid::regclass::text,
           pg_catalog.md5(c.relrowsecurity::text || '|' || c.relforcerowsecurity::text || '|' || COALESCE(c.relacl::text, ''))
      FROM pg_catalog.pg_class c
     WHERE c.oid IN ('public.tareas'::regclass, 'public.tareas_recurrentes'::regclass, 'public.notifications'::regclass,
                     'public.notification_deliveries'::regclass, 'public.notification_reads'::regclass);
  RETURN QUERY
    SELECT 'politica ' || pol.polrelid::regclass::text || '.' || pol.polname,
           pg_catalog.md5(pol.polcmd::text || '|' || pol.polpermissive::text || '|' || pol.polroles::text || '|'
                          || COALESCE(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || '|'
                          || COALESCE(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), ''))
      FROM pg_catalog.pg_policy pol
     WHERE pol.polrelid IN ('public.tareas'::regclass, 'public.tareas_recurrentes'::regclass, 'public.notifications'::regclass,
                            'public.notification_deliveries'::regclass, 'public.notification_reads'::regclass);
  IF pg_catalog.to_regclass('cron.job') IS NOT NULL THEN
    RETURN QUERY EXECUTE
      'SELECT ''cron '' || j.jobname, pg_catalog.md5(j.schedule || ''|'' || j.command || ''|'' || j.active::text)
         FROM cron.job j WHERE j.command ILIKE ''%tarea%''';
  END IF;
END
$f$;

-- -----------------------------------------------------------------------------------------------------
-- Copias completas.
-- -----------------------------------------------------------------------------------------------------
CREATE TABLE etapa3_backup.tareas_recurrentes AS SELECT * FROM etapa3_backup.sel_tareas_recurrentes();
CREATE TABLE etapa3_backup.tareas AS SELECT * FROM etapa3_backup.sel_tareas();
CREATE TABLE etapa3_backup.notifications AS SELECT * FROM etapa3_backup.sel_notifications();
CREATE TABLE etapa3_backup.notification_deliveries AS SELECT * FROM etapa3_backup.sel_notification_deliveries();
CREATE TABLE etapa3_backup.notification_reads AS SELECT * FROM etapa3_backup.sel_notification_reads();
ALTER TABLE etapa3_backup.tareas_recurrentes ADD PRIMARY KEY (id);
ALTER TABLE etapa3_backup.tareas ADD PRIMARY KEY (id);
ALTER TABLE etapa3_backup.notifications ADD PRIMARY KEY (id);
ALTER TABLE etapa3_backup.notification_deliveries ADD PRIMARY KEY (id);
ALTER TABLE etapa3_backup.notification_reads ADD PRIMARY KEY (id);

CREATE TABLE etapa3_backup.manifest (
  clave text PRIMARY KEY,
  cantidad bigint,
  checksum text,
  ids text,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  registrado_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
CREATE TABLE etapa3_backup.manifest_ids (conjunto text NOT NULL, id uuid NOT NULL, PRIMARY KEY (conjunto, id));

INSERT INTO etapa3_backup.manifest (clave, cantidad, checksum, ids)
SELECT t.tabla, h.cantidad, h.checksum, h.ids
  FROM pg_catalog.unnest(ARRAY['tareas_recurrentes', 'tareas', 'notifications', 'notification_deliveries', 'notification_reads']) AS t(tabla),
       LATERAL etapa3_backup.huella(pg_catalog.format('SELECT * FROM etapa3_backup.%I', t.tabla)) h;

UPDATE etapa3_backup.manifest SET detalle = pg_catalog.jsonb_build_object(
  'por_tipo', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT tipo AS k, pg_catalog.count(*) AS n FROM etapa3_backup.tareas GROUP BY 1) x),
  'por_estado', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT estado AS k, pg_catalog.count(*) AS n FROM etapa3_backup.tareas GROUP BY 1) x),
  'por_tipo_estado', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT tipo || '/' || estado AS k, pg_catalog.count(*) AS n FROM etapa3_backup.tareas GROUP BY 1) x),
  'por_organizacion', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT organization_id::text AS k, pg_catalog.count(*) AS n FROM etapa3_backup.tareas GROUP BY 1) x),
  'por_sucursal', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT COALESCE(sucursal_id::text, 'sin_sucursal') AS k, pg_catalog.count(*) AS n FROM etapa3_backup.tareas GROUP BY 1) x),
  'con_recurrencia_id', (SELECT pg_catalog.count(*) FROM etapa3_backup.tareas WHERE recurrencia_id IS NOT NULL))
 WHERE clave = 'tareas';
UPDATE etapa3_backup.manifest SET detalle = pg_catalog.jsonb_build_object(
  'por_organizacion', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT organization_id::text AS k, pg_catalog.count(*) AS n FROM etapa3_backup.tareas_recurrentes GROUP BY 1) x),
  'por_sucursal', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT sucursal_id::text AS k, pg_catalog.count(*) AS n FROM etapa3_backup.tareas_recurrentes GROUP BY 1) x),
  'activas', (SELECT pg_catalog.count(*) FROM etapa3_backup.tareas_recurrentes WHERE activo),
  'pausadas', (SELECT pg_catalog.count(*) FROM etapa3_backup.tareas_recurrentes WHERE NOT activo))
 WHERE clave = 'tareas_recurrentes';
UPDATE etapa3_backup.manifest SET detalle = pg_catalog.jsonb_build_object(
  'por_tipo', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT type AS k, pg_catalog.count(*) AS n FROM etapa3_backup.notifications GROUP BY 1) x),
  'por_source_table', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT source_table AS k, pg_catalog.count(*) AS n FROM etapa3_backup.notifications GROUP BY 1) x),
  'por_organizacion', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT organization_id::text AS k, pg_catalog.count(*) AS n FROM etapa3_backup.notifications GROUP BY 1) x),
  'huerfanas', (SELECT pg_catalog.count(*) FROM etapa3_backup.notifications n
                 WHERE NOT EXISTS (SELECT 1 FROM public.tareas t WHERE t.id = n.source_id)
                   AND NOT EXISTS (SELECT 1 FROM public.tareas_recurrentes r WHERE r.id = n.source_id)))
 WHERE clave = 'notifications';
UPDATE etapa3_backup.manifest SET detalle = pg_catalog.jsonb_build_object(
  'por_organizacion', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT organization_id::text AS k, pg_catalog.count(*) AS n FROM etapa3_backup.notification_deliveries GROUP BY 1) x))
 WHERE clave = 'notification_deliveries';
UPDATE etapa3_backup.manifest SET detalle = pg_catalog.jsonb_build_object(
  'por_organizacion', (SELECT pg_catalog.jsonb_object_agg(k, n) FROM (SELECT organization_id::text AS k, pg_catalog.count(*) AS n FROM etapa3_backup.notification_reads GROUP BY 1) x))
 WHERE clave = 'notification_reads';

-- Controles: lo que el reset NO debe tocar.
INSERT INTO etapa3_backup.manifest (clave, cantidad, checksum, ids)
SELECT 'control_peticiones', h.cantidad, h.checksum, h.ids
  FROM etapa3_backup.huella('SELECT t.* FROM public.tareas t WHERE t.tipo = ''peticion''') h;
INSERT INTO etapa3_backup.manifest (clave, cantidad, checksum, ids)
SELECT 'control_otras_notifications', h.cantidad, NULL, h.ids
  FROM etapa3_backup.huella('SELECT n.id FROM public.notifications n WHERE n.id NOT IN (SELECT b.id FROM etapa3_backup.notifications b)') h;
INSERT INTO etapa3_backup.manifest (clave, cantidad, checksum, ids)
SELECT 'control_otras_notification_deliveries', h.cantidad, NULL, h.ids
  FROM etapa3_backup.huella('SELECT d.id FROM public.notification_deliveries d WHERE d.id NOT IN (SELECT b.id FROM etapa3_backup.notification_deliveries b)') h;
INSERT INTO etapa3_backup.manifest (clave, cantidad, checksum, ids)
SELECT 'control_otras_notification_reads', h.cantidad, NULL, h.ids
  FROM etapa3_backup.huella('SELECT r.id FROM public.notification_reads r WHERE r.id NOT IN (SELECT b.id FROM etapa3_backup.notification_reads b)') h;
INSERT INTO etapa3_backup.manifest (clave, cantidad, ids, detalle)
SELECT 'control_' || f.tabla, f.cantidad, f.ids, pg_catalog.jsonb_build_object('max_updated_at', f.max_updated_at)
  FROM etapa3_backup.foto_protegida() f;
INSERT INTO etapa3_backup.manifest (clave, cantidad, checksum, detalle)
SELECT 'motor_etapa2', pg_catalog.count(*), pg_catalog.md5(pg_catalog.string_agg(m.objeto || '=' || m.huella, ',' ORDER BY m.objeto)),
       pg_catalog.jsonb_object_agg(m.objeto, m.huella)
  FROM etapa3_backup.foto_motor() m;
INSERT INTO etapa3_backup.manifest (clave, detalle)
VALUES ('meta', pg_catalog.jsonb_build_object(
  'etapa', 'Etapa 3 · BUILD 3 · reset pre-lanzamiento de Tareas',
  'proyecto', 'azqpyfoobpovqosbayvz',
  'servidor', pg_catalog.current_setting('server_version'),
  'creado_por', CURRENT_USER,
  'creado_at', pg_catalog.now()));

INSERT INTO etapa3_backup.manifest_ids (conjunto, id)
SELECT 'peticiones', t.id FROM public.tareas t WHERE t.tipo = 'peticion'
UNION ALL
SELECT 'otras_notifications', n.id FROM public.notifications n WHERE n.id NOT IN (SELECT b.id FROM etapa3_backup.notifications b)
UNION ALL
SELECT 'otras_notification_deliveries', d.id FROM public.notification_deliveries d WHERE d.id NOT IN (SELECT b.id FROM etapa3_backup.notification_deliveries b)
UNION ALL
SELECT 'otras_notification_reads', r.id FROM public.notification_reads r WHERE r.id NOT IN (SELECT b.id FROM etapa3_backup.notification_reads b);

-- -----------------------------------------------------------------------------------------------------
-- Verificación del backup (la usan los pasos 2 a 4; cualquier ok=false detiene).
-- -----------------------------------------------------------------------------------------------------
CREATE FUNCTION etapa3_backup.comparar_con_vivo()
RETURNS TABLE (tabla text, cantidad_backup bigint, cantidad_vivo bigint, solo_en_backup bigint, solo_en_vivo bigint, coincide boolean)
LANGUAGE plpgsql STABLE SET search_path = '' AS $f$
DECLARE
  v_b record;
  v_v record;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['tareas_recurrentes', 'tareas', 'notifications', 'notification_deliveries', 'notification_reads'] LOOP
    SELECT * INTO v_b FROM etapa3_backup.huella(pg_catalog.format('SELECT * FROM etapa3_backup.%I', tabla));
    SELECT * INTO v_v FROM etapa3_backup.huella(pg_catalog.format('SELECT * FROM etapa3_backup.%I()', 'sel_' || tabla));
    EXECUTE pg_catalog.format('SELECT pg_catalog.count(*) FROM (SELECT id FROM etapa3_backup.%I EXCEPT SELECT id FROM etapa3_backup.%I()) x',
                              tabla, 'sel_' || tabla) INTO solo_en_backup;
    EXECUTE pg_catalog.format('SELECT pg_catalog.count(*) FROM (SELECT id FROM etapa3_backup.%I() EXCEPT SELECT id FROM etapa3_backup.%I) x',
                              'sel_' || tabla, tabla) INTO solo_en_vivo;
    cantidad_backup := v_b.cantidad;
    cantidad_vivo := v_v.cantidad;
    coincide := v_b.cantidad = v_v.cantidad AND v_b.checksum = v_v.checksum AND v_b.ids = v_v.ids
                AND solo_en_backup = 0 AND solo_en_vivo = 0;
    RETURN NEXT;
  END LOOP;
END
$f$;

CREATE FUNCTION etapa3_backup.verificar() RETURNS TABLE (chequeo text, detalle text, ok boolean)
LANGUAGE plpgsql STABLE SET search_path = '' AS $f$
DECLARE
  r record;
  v_motor text;
BEGIN
  -- 1. Backup = alcance vivo (cantidades, conjuntos de ids en ambos sentidos y checksums).
  FOR r IN SELECT * FROM etapa3_backup.comparar_con_vivo() LOOP
    chequeo := 'backup = vivo: ' || r.tabla;
    detalle := pg_catalog.format('backup %s · vivo %s · solo en backup %s · solo en vivo %s',
                                 r.cantidad_backup, r.cantidad_vivo, r.solo_en_backup, r.solo_en_vivo);
    ok := r.coincide;
    RETURN NEXT;
  END LOOP;
  -- 2. Manifest = backup.
  FOR r IN
    SELECT m.clave, m.cantidad AS mc, m.checksum AS mk, m.ids AS mi, h.cantidad AS hc, h.checksum AS hk, h.ids AS hi
      FROM (SELECT * FROM etapa3_backup.manifest
             WHERE clave IN ('tareas_recurrentes', 'tareas', 'notifications', 'notification_deliveries', 'notification_reads')) m,
           LATERAL etapa3_backup.huella(pg_catalog.format('SELECT * FROM etapa3_backup.%I', m.clave)) h
  LOOP
    chequeo := 'manifest = backup: ' || r.clave;
    detalle := pg_catalog.format('manifest %s · backup %s', r.mc, r.hc);
    ok := r.mc = r.hc AND r.mk = r.hk AND r.mi = r.hi;
    RETURN NEXT;
  END LOOP;
  -- 3. Relaciones internas del backup.
  chequeo := 'relaciones: tareas.recurrencia_id resuelve dentro del backup';
  SELECT pg_catalog.count(*) INTO r FROM etapa3_backup.tareas t
   WHERE t.recurrencia_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM etapa3_backup.tareas_recurrentes x WHERE x.id = t.recurrencia_id);
  detalle := r.count::text || ' sin resolver'; ok := r.count = 0; RETURN NEXT;
  chequeo := 'relaciones: ninguna notificación del backup apunta a un origen vivo fuera del backup';
  SELECT pg_catalog.count(*) INTO r FROM etapa3_backup.notifications n
   WHERE (n.source_table = 'tareas' AND EXISTS (SELECT 1 FROM public.tareas t WHERE t.id = n.source_id)
          AND NOT EXISTS (SELECT 1 FROM etapa3_backup.tareas b WHERE b.id = n.source_id))
      OR (n.source_table = 'tareas_recurrentes' AND EXISTS (SELECT 1 FROM public.tareas_recurrentes x WHERE x.id = n.source_id)
          AND NOT EXISTS (SELECT 1 FROM etapa3_backup.tareas_recurrentes b WHERE b.id = n.source_id));
  detalle := r.count::text || ' fuera'; ok := r.count = 0; RETURN NEXT;
  chequeo := 'relaciones: entregas y lecturas resuelven contra notifications del backup';
  SELECT pg_catalog.count(*) INTO r FROM (
    SELECT d.notification_id FROM etapa3_backup.notification_deliveries d
    UNION ALL SELECT x.notification_id FROM etapa3_backup.notification_reads x) y
   WHERE NOT EXISTS (SELECT 1 FROM etapa3_backup.notifications n WHERE n.id = y.notification_id);
  detalle := r.count::text || ' sin resolver'; ok := r.count = 0; RETURN NEXT;
  -- 4. Ambigüedades (stop conditions).
  FOR r IN SELECT * FROM etapa3_backup.ambiguedades() LOOP
    chequeo := 'sin ambigüedad: ' || r.motivo; detalle := r.cantidad::text; ok := r.cantidad = 0; RETURN NEXT;
  END LOOP;
  -- 5. Seguridad del schema de backup.
  chequeo := 'seguridad: anon, authenticated y service_role sin acceso a etapa3_backup';
  SELECT pg_catalog.count(*) INTO r
    FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS rol(nombre)
   WHERE pg_catalog.has_schema_privilege(rol.nombre, 'etapa3_backup', 'USAGE')
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace
                  WHERE ns.nspname = 'etapa3_backup' AND c.relkind = 'r'
                    AND pg_catalog.has_table_privilege(rol.nombre, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'))
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
                  WHERE ns.nspname = 'etapa3_backup' AND pg_catalog.has_function_privilege(rol.nombre, p.oid, 'EXECUTE'));
  detalle := r.count::text || ' roles con acceso'; ok := r.count = 0; RETURN NEXT;
  chequeo := 'seguridad: PUBLIC sin EXECUTE en las funciones de etapa3_backup';
  SELECT pg_catalog.count(*) INTO r
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace,
         LATERAL pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   WHERE ns.nspname = 'etapa3_backup' AND a.grantee = 0 AND a.privilege_type = 'EXECUTE';
  detalle := r.count::text || ' funciones abiertas'; ok := r.count = 0; RETURN NEXT;
  -- 6. Alcance del backup: solo las tablas aprobadas.
  chequeo := 'alcance: etapa3_backup contiene solo las tablas aprobadas';
  SELECT pg_catalog.count(*) INTO r
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'etapa3_backup' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
     AND c.relname NOT IN ('tareas_recurrentes', 'tareas', 'notifications', 'notification_deliveries', 'notification_reads',
                           'manifest', 'manifest_ids');
  detalle := r.count::text || ' tablas no aprobadas'; ok := r.count = 0; RETURN NEXT;
  -- 7. Motor de la Etapa 2 sin cambios desde el backup y con sus triggers habilitados.
  chequeo := 'motor Etapa 2 igual al registrado en el manifest';
  SELECT pg_catalog.md5(pg_catalog.string_agg(m.objeto || '=' || m.huella, ',' ORDER BY m.objeto)) INTO v_motor FROM etapa3_backup.foto_motor() m;
  detalle := CASE WHEN v_motor = (SELECT checksum FROM etapa3_backup.manifest WHERE clave = 'motor_etapa2') THEN 'igual' ELSE 'distinto' END;
  ok := detalle = 'igual'; RETURN NEXT;
  chequeo := 'triggers de tareas y tareas_recurrentes habilitados';
  SELECT pg_catalog.count(*) INTO r FROM pg_catalog.pg_trigger g
   WHERE NOT g.tgisinternal AND g.tgrelid IN ('public.tareas'::regclass, 'public.tareas_recurrentes'::regclass) AND g.tgenabled <> 'O';
  detalle := r.count::text || ' deshabilitados'; ok := r.count = 0; RETURN NEXT;
END
$f$;

-- -----------------------------------------------------------------------------------------------------
-- Borrado (lo usan el ensayo y el reset): por id del backup verificado Y con el criterio vivo del alcance.
-- Orden: notifications (entregas y lecturas caen por ON DELETE CASCADE) → tareas → tareas_recurrentes.
-- -----------------------------------------------------------------------------------------------------
CREATE FUNCTION etapa3_backup._borrar() RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' AS $f$
DECLARE
  v_n bigint; v_t bigint; v_r bigint;
  v_en bigint; v_et bigint; v_er bigint; v_ed bigint; v_el bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO v_en FROM etapa3_backup.notifications;
  SELECT pg_catalog.count(*) INTO v_ed FROM etapa3_backup.notification_deliveries;
  SELECT pg_catalog.count(*) INTO v_el FROM etapa3_backup.notification_reads;
  SELECT pg_catalog.count(*) INTO v_et FROM etapa3_backup.tareas;
  SELECT pg_catalog.count(*) INTO v_er FROM etapa3_backup.tareas_recurrentes;

  DELETE FROM public.notifications n
   USING etapa3_backup.notifications b
   WHERE n.id = b.id
     AND n.id IN (SELECT s.id FROM etapa3_backup.sel_notifications() s);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> v_en THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: se borrarían % notificaciones y el backup tiene %', v_n, v_en;
  END IF;
  IF EXISTS (SELECT 1 FROM public.notification_deliveries d JOIN etapa3_backup.notification_deliveries b ON b.id = d.id)
     OR EXISTS (SELECT 1 FROM public.notification_reads x JOIN etapa3_backup.notification_reads b ON b.id = x.id) THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: las entregas o lecturas del alcance no cayeron en cascada';
  END IF;

  DELETE FROM public.tareas t
   USING etapa3_backup.tareas b
   WHERE t.id = b.id
     AND t.tipo IN ('admin', 'tarea');
  GET DIAGNOSTICS v_t = ROW_COUNT;
  IF v_t <> v_et THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: se borrarían % tareas y el backup tiene %', v_t, v_et;
  END IF;

  DELETE FROM public.tareas_recurrentes r
   USING etapa3_backup.tareas_recurrentes b
   WHERE r.id = b.id;
  GET DIAGNOSTICS v_r = ROW_COUNT;
  IF v_r <> v_er THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: se borrarían % Tareas automáticas y el backup tiene %', v_r, v_er;
  END IF;

  RETURN pg_catalog.jsonb_build_object('notifications', v_n, 'notification_deliveries', v_ed, 'notification_reads', v_el,
                                       'tareas', v_t, 'tareas_recurrentes', v_r);
END
$f$;

-- -----------------------------------------------------------------------------------------------------
-- Restauración desde etapa3_backup (orden R → T → N → entregas → lecturas). Desactiva SOLO los triggers de
-- usuario de tareas y tareas_recurrentes (no puede usarse session_replication_role) y los vuelve a activar;
-- como todo es DDL transaccional, si algo falla la transacción se revierte con los triggers habilitados.
-- Aborta si alguna fila del backup ya existe en public (no pisa nada). Después del CHECK de la migración 3B
-- las filas 'admin' no pueden volver: restaurarlas exige quitar antes ese CHECK.
-- -----------------------------------------------------------------------------------------------------
CREATE FUNCTION etapa3_backup.restaurar() RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' AS $f$
DECLARE
  v_tabla text;
  v_cols text;
  v_n bigint;
  v_out jsonb := '{}'::jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.tareas_recurrentes x JOIN etapa3_backup.tareas_recurrentes b ON b.id = x.id)
     OR EXISTS (SELECT 1 FROM public.tareas x JOIN etapa3_backup.tareas b ON b.id = x.id)
     OR EXISTS (SELECT 1 FROM public.notifications x JOIN etapa3_backup.notifications b ON b.id = x.id
                 OR (b.organization_id = x.organization_id AND b.event_key = x.event_key))
     OR EXISTS (SELECT 1 FROM public.notification_deliveries x JOIN etapa3_backup.notification_deliveries b ON b.id = x.id)
     OR EXISTS (SELECT 1 FROM public.notification_reads x JOIN etapa3_backup.notification_reads b ON b.id = x.id) THEN
    RAISE EXCEPTION 'ETAPA3_RESTORE_ABORT: hay filas del backup que ya existen en public; no se pisa nada.';
  END IF;

  ALTER TABLE public.tareas_recurrentes DISABLE TRIGGER USER;
  ALTER TABLE public.tareas DISABLE TRIGGER USER;
  FOREACH v_tabla IN ARRAY ARRAY['tareas_recurrentes', 'tareas', 'notifications', 'notification_deliveries', 'notification_reads'] LOOP
    SELECT pg_catalog.string_agg(pg_catalog.quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO v_cols
      FROM pg_catalog.pg_attribute a
     WHERE a.attrelid = pg_catalog.format('etapa3_backup.%I', v_tabla)::regclass AND a.attnum > 0 AND NOT a.attisdropped;
    EXECUTE pg_catalog.format('INSERT INTO public.%I (%s) SELECT %s FROM etapa3_backup.%I', v_tabla, v_cols, v_cols, v_tabla);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_out := v_out || pg_catalog.jsonb_build_object(v_tabla, v_n);
  END LOOP;
  ALTER TABLE public.tareas ENABLE TRIGGER USER;
  ALTER TABLE public.tareas_recurrentes ENABLE TRIGGER USER;
  RETURN v_out;
END
$f$;

-- -----------------------------------------------------------------------------------------------------
-- Ensayo: borra y restaura dentro de un sub-bloque que SIEMPRE se revierte. No deja cambios.
-- -----------------------------------------------------------------------------------------------------
CREATE FUNCTION etapa3_backup.ensayo_restore() RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' AS $f$
DECLARE
  v_borrado jsonb;
  v_restaurado jsonb;
  v_otras_antes text;
  v_otras_despues text;
BEGIN
  LOCK TABLE public.tareas_recurrentes, public.tareas IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM etapa3_backup.verificar() v WHERE NOT v.ok) THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: la verificación del backup falló; ver etapa3_backup.verificar()';
  END IF;
  SELECT h.ids INTO v_otras_antes FROM etapa3_backup.huella(
    'SELECT n.id FROM public.notifications n WHERE n.id NOT IN (SELECT b.id FROM etapa3_backup.notifications b)') h;
  BEGIN
    v_borrado := etapa3_backup._borrar();
    IF EXISTS (SELECT 1 FROM etapa3_backup.sel_tareas()) OR EXISTS (SELECT 1 FROM etapa3_backup.sel_tareas_recurrentes())
       OR EXISTS (SELECT 1 FROM etapa3_backup.sel_notifications()) THEN
      RAISE EXCEPTION 'ETAPA3_ENSAYO_FALLO: el borrado simulado dejó filas del alcance';
    END IF;
    v_restaurado := etapa3_backup.restaurar();
    IF EXISTS (SELECT 1 FROM etapa3_backup.comparar_con_vivo() c WHERE NOT c.coincide) THEN
      RAISE EXCEPTION 'ETAPA3_ENSAYO_FALLO: la restauración no reproduce el backup (ids o checksums distintos)';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g WHERE NOT g.tgisinternal AND g.tgenabled <> 'O'
                  AND g.tgrelid IN ('public.tareas'::regclass, 'public.tareas_recurrentes'::regclass)) THEN
      RAISE EXCEPTION 'ETAPA3_ENSAYO_FALLO: quedaron triggers deshabilitados después de restaurar';
    END IF;
    SELECT h.ids INTO v_otras_despues FROM etapa3_backup.huella(
      'SELECT n.id FROM public.notifications n WHERE n.id NOT IN (SELECT b.id FROM etapa3_backup.notifications b)') h;
    IF v_otras_despues IS DISTINCT FROM v_otras_antes THEN
      RAISE EXCEPTION 'ETAPA3_ENSAYO_FALLO: el ensayo alteró notificaciones ajenas';
    END IF;
    RAISE EXCEPTION 'ETAPA3_ENSAYO_REVERTIR';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'ETAPA3_ENSAYO_REVERTIR' THEN RAISE; END IF;
  END;
  -- El sub-bloque se revirtió: todo tiene que estar exactamente como al comienzo.
  IF EXISTS (SELECT 1 FROM etapa3_backup.comparar_con_vivo() c WHERE NOT c.coincide) THEN
    RAISE EXCEPTION 'ETAPA3_ENSAYO_FALLO: el estado no volvió al inicio';
  END IF;
  RETURN pg_catalog.jsonb_build_object('ensayo', 'ok', 'borrado_simulado', v_borrado, 'restaurado', v_restaurado);
END
$f$;

-- -----------------------------------------------------------------------------------------------------
-- Reset definitivo (paso 4). Recalcula el alcance bajo bloqueo, lo compara con el backup, borra y
-- comprueba todo antes de devolver. Cualquier falla lanza una excepción y la transacción no confirma.
-- Uso único: con el reset ya registrado, no vuelve a borrar nada.
-- -----------------------------------------------------------------------------------------------------
CREATE FUNCTION etapa3_backup.reset() RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' AS $f$
DECLARE
  v_borrado jsonb;
  v_peticiones_antes text;
  v_peticiones_despues text;
  v_protegida_antes jsonb;
  v_protegida_despues jsonb;
  v_motor_antes text;
  v_motor_despues text;
  v_otras_n uuid[];
  v_otras_d uuid[];
  v_otras_r uuid[];
BEGIN
  LOCK TABLE public.tareas_recurrentes, public.tareas IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM etapa3_backup.manifest WHERE clave = 'reset_ejecutado') THEN
    IF NOT EXISTS (SELECT 1 FROM etapa3_backup.sel_tareas()) AND NOT EXISTS (SELECT 1 FROM etapa3_backup.sel_tareas_recurrentes())
       AND NOT EXISTS (SELECT 1 FROM etapa3_backup.sel_notifications()) THEN
      RETURN pg_catalog.jsonb_build_object('ya_aplicado', true, 'borradas', 0);
    END IF;
    RAISE EXCEPTION 'ETAPA3_ABORT: el reset ya se ejecutó y hoy hay filas nuevas en el alcance; no se borran sin un backup nuevo.';
  END IF;

  -- Nadie puede crear entregas/lecturas sobre el alcance ni marcarlas mientras se compara y se borra.
  PERFORM 1 FROM public.notifications n
   WHERE n.id IN (SELECT s.id FROM etapa3_backup.sel_notifications() s) OR n.id IN (SELECT b.id FROM etapa3_backup.notifications b)
     FOR UPDATE;
  PERFORM 1 FROM public.notification_deliveries d
   WHERE d.notification_id IN (SELECT b.id FROM etapa3_backup.notifications b) FOR UPDATE;
  PERFORM 1 FROM public.notification_reads x
   WHERE x.notification_id IN (SELECT b.id FROM etapa3_backup.notifications b) FOR UPDATE;

  -- Revalidación bajo bloqueo: si algo cambió desde el backup, no se borra nada.
  IF EXISTS (SELECT 1 FROM etapa3_backup.verificar() v WHERE NOT v.ok) THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: el alcance vivo ya no coincide con el backup verificado (o hay ambigüedad); rehacer el backup';
  END IF;

  -- Fotos previas de lo que no se debe tocar.
  SELECT h.checksum INTO v_peticiones_antes FROM etapa3_backup.huella('SELECT t.* FROM public.tareas t WHERE t.tipo = ''peticion''') h;
  SELECT pg_catalog.jsonb_agg(f ORDER BY f.tabla) INTO v_protegida_antes FROM etapa3_backup.foto_protegida() f;
  SELECT pg_catalog.md5(pg_catalog.string_agg(m.objeto || '=' || m.huella, ',' ORDER BY m.objeto)) INTO v_motor_antes FROM etapa3_backup.foto_motor() m;
  v_otras_n := ARRAY(SELECT n.id FROM public.notifications n WHERE n.id NOT IN (SELECT b.id FROM etapa3_backup.notifications b));
  v_otras_d := ARRAY(SELECT d.id FROM public.notification_deliveries d WHERE d.id NOT IN (SELECT b.id FROM etapa3_backup.notification_deliveries b));
  v_otras_r := ARRAY(SELECT x.id FROM public.notification_reads x WHERE x.id NOT IN (SELECT b.id FROM etapa3_backup.notification_reads b));

  v_borrado := etapa3_backup._borrar();

  -- Post-condiciones dentro de la misma transacción.
  IF EXISTS (SELECT 1 FROM etapa3_backup.sel_tareas()) OR EXISTS (SELECT 1 FROM etapa3_backup.sel_tareas_recurrentes())
     OR EXISTS (SELECT 1 FROM etapa3_backup.sel_notifications()) OR EXISTS (SELECT 1 FROM etapa3_backup.sel_notification_deliveries())
     OR EXISTS (SELECT 1 FROM etapa3_backup.sel_notification_reads()) THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: quedaron filas del alcance después del borrado';
  END IF;
  IF EXISTS (SELECT 1 FROM public.notifications x JOIN etapa3_backup.notifications b ON b.id = x.id)
     OR EXISTS (SELECT 1 FROM public.notification_deliveries x JOIN etapa3_backup.notification_deliveries b ON b.id = x.id)
     OR EXISTS (SELECT 1 FROM public.notification_reads x JOIN etapa3_backup.notification_reads b ON b.id = x.id)
     OR EXISTS (SELECT 1 FROM public.tareas x JOIN etapa3_backup.tareas b ON b.id = x.id)
     OR EXISTS (SELECT 1 FROM public.tareas_recurrentes x JOIN etapa3_backup.tareas_recurrentes b ON b.id = x.id) THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: alguna fila del backup sigue en public';
  END IF;
  SELECT h.checksum INTO v_peticiones_despues FROM etapa3_backup.huella('SELECT t.* FROM public.tareas t WHERE t.tipo = ''peticion''') h;
  IF v_peticiones_despues IS DISTINCT FROM v_peticiones_antes THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: las peticiones cambiaron';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(v_otras_n) u(id) WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = u.id))
     OR EXISTS (SELECT 1 FROM pg_catalog.unnest(v_otras_d) u(id) WHERE NOT EXISTS (SELECT 1 FROM public.notification_deliveries d WHERE d.id = u.id))
     OR EXISTS (SELECT 1 FROM pg_catalog.unnest(v_otras_r) u(id) WHERE NOT EXISTS (SELECT 1 FROM public.notification_reads x WHERE x.id = u.id)) THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: se perdió una notificación, entrega o lectura ajena al alcance';
  END IF;
  -- Borrar no notifica: la única notificación de Tareas que puede quedar es una que ya existía (peticion_*).
  IF EXISTS (SELECT 1 FROM public.notifications n WHERE n.source_module = 'tareas' AND NOT (n.id = ANY (v_otras_n))) THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: el borrado generó notificaciones de Tareas';
  END IF;
  IF EXISTS (SELECT 1 FROM public.notification_deliveries d WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = d.notification_id))
     OR EXISTS (SELECT 1 FROM public.notification_reads x WHERE x.notification_id IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = x.notification_id)) THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: quedaron entregas o lecturas huérfanas';
  END IF;
  SELECT pg_catalog.jsonb_agg(f ORDER BY f.tabla) INTO v_protegida_despues FROM etapa3_backup.foto_protegida() f;
  IF v_protegida_despues IS DISTINCT FROM v_protegida_antes THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: cambió una tabla protegida (organizations, barberos, sucursales o barberos_sucursales)';
  END IF;
  SELECT pg_catalog.md5(pg_catalog.string_agg(m.objeto || '=' || m.huella, ',' ORDER BY m.objeto)) INTO v_motor_despues FROM etapa3_backup.foto_motor() m;
  IF v_motor_despues IS DISTINCT FROM v_motor_antes THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: el motor de la Etapa 2 (funciones, triggers, grants, RLS o cron) cambió';
  END IF;

  INSERT INTO etapa3_backup.manifest (clave, cantidad, detalle)
  VALUES ('reset_ejecutado', (v_borrado ->> 'tareas')::bigint,
          v_borrado || pg_catalog.jsonb_build_object('ejecutado_at', pg_catalog.now(), 'ejecutado_por', CURRENT_USER));
  RETURN v_borrado;
END
$f$;

-- -----------------------------------------------------------------------------------------------------
-- Post-condiciones de solo lectura (paso 5).
-- -----------------------------------------------------------------------------------------------------
CREATE FUNCTION etapa3_backup.postcondiciones() RETURNS TABLE (chequeo text, detalle text, ok boolean)
LANGUAGE plpgsql STABLE SET search_path = '' AS $f$
DECLARE
  r record;
  v_esperado jsonb;
  v_actual jsonb;
  v_dif text[];
BEGIN
  FOREACH chequeo IN ARRAY ARRAY['tareas_recurrentes', 'tareas', 'notifications', 'notification_deliveries', 'notification_reads'] LOOP
    EXECUTE pg_catalog.format('SELECT pg_catalog.count(*) FROM etapa3_backup.%I()', 'sel_' || chequeo) INTO r;
    detalle := r.count::text || ' en el alcance'; ok := r.count = 0;
    chequeo := 'alcance vacío: ' || chequeo; RETURN NEXT;
  END LOOP;
  chequeo := 'ninguna fila del backup sigue en public';
  SELECT (SELECT pg_catalog.count(*) FROM public.tareas x JOIN etapa3_backup.tareas b ON b.id = x.id)
       + (SELECT pg_catalog.count(*) FROM public.tareas_recurrentes x JOIN etapa3_backup.tareas_recurrentes b ON b.id = x.id)
       + (SELECT pg_catalog.count(*) FROM public.notifications x JOIN etapa3_backup.notifications b ON b.id = x.id)
       + (SELECT pg_catalog.count(*) FROM public.notification_deliveries x JOIN etapa3_backup.notification_deliveries b ON b.id = x.id)
       + (SELECT pg_catalog.count(*) FROM public.notification_reads x JOIN etapa3_backup.notification_reads b ON b.id = x.id) AS n INTO r;
  detalle := r.n::text; ok := r.n = 0; RETURN NEXT;
  chequeo := 'peticiones del manifest presentes';
  SELECT pg_catalog.count(*) AS n INTO r FROM etapa3_backup.manifest_ids m
   WHERE m.conjunto = 'peticiones' AND NOT EXISTS (SELECT 1 FROM public.tareas t WHERE t.id = m.id AND t.tipo = 'peticion');
  detalle := r.n::text || ' faltantes'; ok := r.n = 0; RETURN NEXT;
  FOREACH chequeo IN ARRAY ARRAY['notifications', 'notification_deliveries', 'notification_reads'] LOOP
    EXECUTE pg_catalog.format('SELECT pg_catalog.count(*) FROM etapa3_backup.manifest_ids m WHERE m.conjunto = %L
                                 AND NOT EXISTS (SELECT 1 FROM public.%I x WHERE x.id = m.id)', 'otras_' || chequeo, chequeo) INTO r;
    detalle := r.count::text || ' faltantes';
    ok := r.count = 0;
    chequeo := 'filas ajenas al alcance presentes: ' || chequeo; RETURN NEXT;
  END LOOP;
  chequeo := 'sin entregas ni lecturas huérfanas';
  SELECT (SELECT pg_catalog.count(*) FROM public.notification_deliveries d WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = d.notification_id))
       + (SELECT pg_catalog.count(*) FROM public.notification_reads x WHERE x.notification_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = x.notification_id)) AS n INTO r;
  detalle := r.n::text; ok := r.n = 0; RETURN NEXT;
  chequeo := 'sin constraints sin validar en las tablas del módulo';
  SELECT pg_catalog.count(*) AS n INTO r FROM pg_catalog.pg_constraint c
   WHERE NOT c.convalidated AND c.conrelid IN ('public.tareas'::regclass, 'public.tareas_recurrentes'::regclass, 'public.notifications'::regclass,
                                               'public.notification_deliveries'::regclass, 'public.notification_reads'::regclass);
  detalle := r.n::text; ok := r.n = 0; RETURN NEXT;
  chequeo := 'aislamiento: notificaciones de Tareas con origen de otra organización';
  SELECT pg_catalog.count(*) AS n INTO r FROM public.notifications n
   WHERE n.source_module = 'tareas'
     AND (EXISTS (SELECT 1 FROM public.tareas t WHERE n.source_table = 'tareas' AND t.id = n.source_id AND t.organization_id <> n.organization_id)
       OR EXISTS (SELECT 1 FROM public.tareas_recurrentes x WHERE n.source_table = 'tareas_recurrentes' AND x.id = n.source_id AND x.organization_id <> n.organization_id));
  detalle := r.n::text; ok := r.n = 0; RETURN NEXT;
  chequeo := 'aislamiento: entregas con otra organización que su notificación';
  SELECT pg_catalog.count(*) AS n INTO r FROM public.notification_deliveries d JOIN public.notifications n ON n.id = d.notification_id
   WHERE n.organization_id <> d.organization_id;
  detalle := r.n::text; ok := r.n = 0; RETURN NEXT;
  -- Tablas protegidas contra la foto del manifest.
  FOR r IN SELECT f.*, m.cantidad AS mc, m.ids AS mi, m.detalle ->> 'max_updated_at' AS mu
             FROM etapa3_backup.foto_protegida() f JOIN etapa3_backup.manifest m ON m.clave = 'control_' || f.tabla LOOP
    chequeo := 'protegida sin cambios: ' || r.tabla;
    detalle := pg_catalog.format('antes %s · ahora %s · max(updated_at) %s', r.mc, r.cantidad,
                                 CASE WHEN r.max_updated_at IS NOT DISTINCT FROM r.mu THEN 'igual' ELSE 'distinto' END);
    ok := r.cantidad = r.mc AND r.ids = r.mi AND r.max_updated_at IS NOT DISTINCT FROM r.mu;
    RETURN NEXT;
  END LOOP;
  -- Motor de la Etapa 2: igual al manifest, salvo lo que la migración 3B quita a propósito.
  SELECT m.detalle INTO v_esperado FROM etapa3_backup.manifest m WHERE m.clave = 'motor_etapa2';
  SELECT pg_catalog.jsonb_object_agg(m.objeto, m.huella) INTO v_actual FROM etapa3_backup.foto_motor() m;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.tareas'::regclass AND conname = 'tareas_tipo_check') THEN
    v_esperado := v_esperado - 'funcion public.trg_tareas_tipo_guard()' - 'trigger tareas.trg_tareas_tipo_guard' - 'trigger public.tareas.trg_tareas_tipo_guard';
  END IF;
  SELECT pg_catalog.array_agg(k ORDER BY k) INTO v_dif FROM (
    SELECT e.key AS k FROM pg_catalog.jsonb_each_text(v_esperado) e WHERE (v_actual ->> e.key) IS DISTINCT FROM e.value
    UNION
    SELECT a.key FROM pg_catalog.jsonb_each_text(v_actual) a WHERE NOT (v_esperado ? a.key)) x;
  chequeo := 'motor Etapa 2, grants, RLS y cron intactos';
  detalle := COALESCE(pg_catalog.array_to_string(v_dif, ', '), 'igual');
  ok := v_dif IS NULL;
  RETURN NEXT;
  chequeo := 'reset registrado en el manifest';
  detalle := COALESCE((SELECT m.detalle::text FROM etapa3_backup.manifest m WHERE m.clave = 'reset_ejecutado'), 'no');
  ok := detalle <> 'no';
  RETURN NEXT;
END
$f$;

-- -----------------------------------------------------------------------------------------------------
-- Sin acceso para roles cliente (solo el dueño).
-- -----------------------------------------------------------------------------------------------------
REVOKE ALL ON SCHEMA etapa3_backup FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA etapa3_backup FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA etapa3_backup FROM PUBLIC, anon, authenticated, service_role;

-- El backup solo se confirma si todas las verificaciones pasan.
DO $verifica$
DECLARE
  v_fallas text;
BEGIN
  SELECT pg_catalog.string_agg(v.chequeo || ' (' || v.detalle || ')', '; ') INTO v_fallas FROM etapa3_backup.verificar() v WHERE NOT v.ok;
  IF v_fallas IS NOT NULL THEN
    RAISE EXCEPTION 'ETAPA3_ABORT: el backup no pasó la verificación: %', v_fallas;
  END IF;
END
$verifica$;

COMMIT;
