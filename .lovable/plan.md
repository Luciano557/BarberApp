> Fase 1 (v4). Solo base de datos. NO se toca UI, hooks, Cobrar, PaymentRegistration, MiNegocioPanel, ServicesConfig, ExtrasConfig, DiscountsConfig, ProductosConfig, columnas legacy ni ventas históricas. Tampoco se bloquea al barber para cobrar (Fase 2).
> Una sola migración atómica.

---

# 1. Estado verificado

- `servicios_sucursales`: no existe → crear.
- `extras_sucursales`: no existe → crear.
- `descuentos_sucursales`: existe. Tiene 7 filas inconsistentes → vaciar y reconstruir.
- `productos_sucursal`: existe. Ya tiene `UNIQUE (producto_id, sucursal_id)` y 0 duplicados.
- 15 servicios, 8 extras, 4 descuentos, 2 productos, 15 sucursales en 14 organizaciones.
- Helpers existentes: `get_user_organization_id`, `get_user_sucursal_ids`, `has_role`, `update_updated_at_column`.

---

# 2. Tablas nuevas

## 2.1 `servicios_sucursales`

```text
id               uuid PK default gen_random_uuid()
organization_id  uuid NOT NULL
servicio_id      uuid NOT NULL  REFERENCES servicios(id)  ON DELETE CASCADE
sucursal_id      uuid NOT NULL  REFERENCES sucursales(id) ON DELETE CASCADE
activo           boolean NOT NULL DEFAULT true
precio           numeric NOT NULL DEFAULT 0
created_at       timestamptz NOT NULL DEFAULT now()
updated_at       timestamptz NOT NULL DEFAULT now()

UNIQUE (organization_id, servicio_id, sucursal_id)
INDEX  (organization_id), (sucursal_id, activo), (servicio_id)
TRIGGER set_updated_at → public.update_updated_at_column()
```

## 2.2 `extras_sucursales`

Análoga, con `extra_id` en lugar de `servicio_id`.

---

# 3. Ajuste de `descuentos_sucursales`

- No DROP.
- `DELETE FROM descuentos_sucursales;`
- Asegurar `UNIQUE (organization_id, descuento_id, sucursal_id)`, índices y trigger updated_at.

---

# 4. Backfill (orden A → C → B)

## 4.1 `servicios_sucursales`

```sql
-- A) Sucursal de origen (sucursal_id NOT NULL): activo y precio reales
INSERT INTO servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
SELECT s.organization_id, s.id, s.sucursal_id, s.activo, COALESCE(s.precio, 0)
FROM servicios s
WHERE s.sucursal_id IS NOT NULL
ON CONFLICT (organization_id, servicio_id, sucursal_id) DO NOTHING;

-- C) Servicios con sucursal_id NULL: aplicar valores legacy a TODAS las sucursales
INSERT INTO servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
SELECT s.organization_id, s.id, su.id, s.activo, COALESCE(s.precio, 0)
FROM servicios s
JOIN sucursales su ON su.organization_id = s.organization_id
WHERE s.sucursal_id IS NULL
ON CONFLICT (organization_id, servicio_id, sucursal_id) DO NOTHING;

-- B) Relleno final: completar combinaciones faltantes con activo=true, precio=0
INSERT INTO servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
SELECT s.organization_id, s.id, su.id, true, 0
FROM servicios s
JOIN sucursales su ON su.organization_id = s.organization_id
ON CONFLICT (organization_id, servicio_id, sucursal_id) DO NOTHING;
```

## 4.2 `extras_sucursales`

Mismo orden A → C → B usando `extras`.

## 4.3 `descuentos_sucursales` (reconstrucción limpia)

```sql
DELETE FROM descuentos_sucursales;

INSERT INTO descuentos_sucursales (organization_id, descuento_id, sucursal_id, activo)
SELECT d.organization_id, d.id, su.id, d.activo
FROM descuentos d
JOIN sucursales su ON su.organization_id = d.organization_id
ON CONFLICT (organization_id, descuento_id, sucursal_id) DO NOTHING;
```

## 4.4 `productos_sucursal` faltantes (sin tocar filas existentes)

```sql
INSERT INTO productos_sucursal
  (organization_id, producto_id, sucursal_id, activo,
   precio_venta, precio_costo, stock_actual, stock_minimo)
SELECT
  p.organization_id, p.id, su.id, true,
  COALESCE(
    (SELECT ps.precio_venta FROM productos_sucursal ps
     WHERE ps.producto_id = p.id
     ORDER BY ps.created_at ASC NULLS LAST LIMIT 1),
    0
  ),
  NULL, 0, 0
FROM productos p
JOIN sucursales su ON su.organization_id = p.organization_id
ON CONFLICT (producto_id, sucursal_id) DO NOTHING;
```

---

# 5. Triggers de auto-clonado

Todas las funciones `SECURITY DEFINER`, `SET search_path = public`.

## 5.1 Servicio nuevo (`AFTER INSERT ON servicios`)

```text
IF NEW.sucursal_id IS NOT NULL THEN
  INSERT INTO servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
  VALUES (NEW.organization_id, NEW.id, NEW.sucursal_id, NEW.activo, COALESCE(NEW.precio, 0))
  ON CONFLICT DO NOTHING;

  INSERT INTO servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
  SELECT NEW.organization_id, NEW.id, su.id, true, 0
  FROM sucursales su
  WHERE su.organization_id = NEW.organization_id AND su.id <> NEW.sucursal_id
  ON CONFLICT DO NOTHING;
ELSE
  INSERT INTO servicios_sucursales (organization_id, servicio_id, sucursal_id, activo, precio)
  SELECT NEW.organization_id, NEW.id, su.id, NEW.activo, COALESCE(NEW.precio, 0)
  FROM sucursales su WHERE su.organization_id = NEW.organization_id
  ON CONFLICT DO NOTHING;
END IF;
```

## 5.2 Extra nuevo (`AFTER INSERT ON extras`)

Idéntica lógica.

## 5.3 Descuento nuevo (`AFTER INSERT ON descuentos`)

```text
INSERT INTO descuentos_sucursales (organization_id, descuento_id, sucursal_id, activo)
SELECT NEW.organization_id, NEW.id, su.id, NEW.activo
FROM sucursales su WHERE su.organization_id = NEW.organization_id
ON CONFLICT DO NOTHING;
```

## 5.4 Producto — trigger sobre `productos_sucursal` con guardia anti-recursión

`AFTER INSERT ON productos_sucursal`:

```text
CREATE OR REPLACE FUNCTION clone_producto_sucursal_to_others()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anti-recursión: si este INSERT fue disparado por el propio trigger
  -- (o por clone_catalog_to_new_sucursal), no volver a propagar.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  INSERT INTO productos_sucursal (
    organization_id, producto_id, sucursal_id, activo,
    precio_venta, precio_costo, stock_actual, stock_minimo
  )
  SELECT
    NEW.organization_id, NEW.producto_id, su.id, true,
    NEW.precio_venta, NEW.precio_costo, 0, 0
  FROM sucursales su
  WHERE su.organization_id = NEW.organization_id
    AND su.id <> NEW.sucursal_id
  ON CONFLICT (producto_id, sucursal_id) DO NOTHING;

  RETURN NEW;
END;
$$;
```

Resultado:
- La sucursal de origen mantiene exactamente lo que insertó la UI.
- Las demás sucursales heredan `precio_venta`/`precio_costo`, `activo=true`, stock 0.
- Los inserts generados por este propio trigger o por `clone_catalog_to_new_sucursal` no vuelven a disparar la propagación.

## 5.5 Sucursal nueva (`AFTER INSERT ON sucursales`)

`clone_catalog_to_new_sucursal()` clona el catálogo completo para la sucursal recién creada:

- `servicios_sucursales`: una fila por servicio de la org → `activo=true, precio=0`.
- `extras_sucursales`: análogo.
- `descuentos_sucursales`: una fila por descuento → `activo = descuentos.activo`.
- `productos_sucursal`: una fila por producto → `activo=true`, `precio_venta`/`precio_costo` desde la sucursal de referencia más antigua si existe (si no `0` / `NULL`); `stock_actual=0`, `stock_minimo=0`.

Todo con `ON CONFLICT DO NOTHING`. La guardia `pg_trigger_depth() > 1` en 5.4 evita que estos inserts vuelvan a propagar.

---

# 6. RLS — Fase 1 conservadora (manager y barber solo SELECT)

Motivo: RLS restringe filas, no columnas. Si se diera UPDATE al manager ahora, podría modificar `servicio_id`, `extra_id`, `descuento_id`, `sucursal_id` u `organization_id`. Como en Fase 1 no se toca UI ni hooks, manager y barber **no necesitan escribir** en estas tablas. Las edición de `activo` y `precio` por manager se habilitará en Fase 2/3 mediante RPCs seguras o triggers que bloqueen cambios estructurales.

Patrón aplicado a `servicios_sucursales`, `extras_sucursales` y `descuentos_sucursales` (en descuentos: DROP previo de las dos políticas existentes).

```sql
ALTER TABLE servicios_sucursales ENABLE ROW LEVEL SECURITY;

-- Owner / General Manager: SELECT en toda la organización
CREATE POLICY "owner_gm_select_servicios_sucursales"
  ON servicios_sucursales FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'general_manager'))
  );

-- Owner / General Manager: ALL en toda la organización
CREATE POLICY "owner_gm_all_servicios_sucursales"
  ON servicios_sucursales FOR ALL
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'general_manager'))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'general_manager'))
  );

-- Manager / Barber: SOLO SELECT en sus sucursales asignadas
CREATE POLICY "manager_barber_select_servicios_sucursales"
  ON servicios_sucursales FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(),'manager') OR has_role(auth.uid(),'barber'))
    AND sucursal_id IN (SELECT get_user_sucursal_ids(auth.uid()))
  );
```

Mismo bloque (3 políticas) en `extras_sucursales` y `descuentos_sucursales`.

Tablas globales (`servicios`, `extras`, `descuentos`, `productos`) y `productos_sucursal` no se tocan.

---

# 7. Validación post-migración

```sql
-- 7.1 Cobertura completa por organización
SELECT 'servicios' AS t,
       (SELECT count(*) FROM servicios_sucursales) AS reales,
       (SELECT SUM((SELECT count(*) FROM servicios   WHERE organization_id=o.id)
                 * (SELECT count(*) FROM sucursales WHERE organization_id=o.id))
        FROM organizations o) AS esperadas
UNION ALL SELECT 'extras',
       (SELECT count(*) FROM extras_sucursales),
       (SELECT SUM((SELECT count(*) FROM extras    WHERE organization_id=o.id)
                 * (SELECT count(*) FROM sucursales WHERE organization_id=o.id)) FROM organizations o)
UNION ALL SELECT 'descuentos',
       (SELECT count(*) FROM descuentos_sucursales),
       (SELECT SUM((SELECT count(*) FROM descuentos WHERE organization_id=o.id)
                 * (SELECT count(*) FROM sucursales  WHERE organization_id=o.id)) FROM organizations o)
UNION ALL SELECT 'productos',
       (SELECT count(*) FROM productos_sucursal),
       (SELECT SUM((SELECT count(*) FROM productos WHERE organization_id=o.id)
                 * (SELECT count(*) FROM sucursales WHERE organization_id=o.id)) FROM organizations o);

-- 7.2 Sin duplicados (esperado: 0)
SELECT organization_id, servicio_id,  sucursal_id, count(*) FROM servicios_sucursales  GROUP BY 1,2,3 HAVING count(*)>1;
SELECT organization_id, extra_id,     sucursal_id, count(*) FROM extras_sucursales     GROUP BY 1,2,3 HAVING count(*)>1;
SELECT organization_id, descuento_id, sucursal_id, count(*) FROM descuentos_sucursales GROUP BY 1,2,3 HAVING count(*)>1;

-- 7.3 Filas de origen respetan activo/precio legacy (esperado: 0)
SELECT count(*) FROM servicios s
JOIN servicios_sucursales ss ON ss.servicio_id=s.id AND ss.sucursal_id=s.sucursal_id
WHERE s.sucursal_id IS NOT NULL
  AND (ss.activo IS DISTINCT FROM s.activo OR ss.precio IS DISTINCT FROM COALESCE(s.precio,0));

-- 7.4 Servicios con sucursal_id NULL: todas sus filas conservan precio legacy (esperado: 0)
SELECT count(*) FROM servicios s
JOIN servicios_sucursales ss ON ss.servicio_id=s.id
WHERE s.sucursal_id IS NULL
  AND ss.precio IS DISTINCT FROM COALESCE(s.precio,0);
```

---

# 8. Lo que NO se toca en Fase 1

- Ningún archivo de `src/`.
- Cobrar / PaymentRegistration / MiNegocio / Servicios / Extras / Descuentos / Productos.
- Bloqueo del barber para cobrar (Fase 2).
- Permiso de UPDATE para manager en tablas por sucursal (Fase 2/3 vía RPC).
- Restricción del manager sobre tablas globales (Fase 2).
- Columnas legacy.
- Ventas históricas, FKs de ventas, RLS de tablas globales, RLS de `productos_sucursal`, `registrar_movimiento_stock`.
- No se crea trigger sobre `productos`.

---

# 9. Reversibilidad

```sql
DROP TRIGGER IF EXISTS trg_clone_servicio              ON servicios;
DROP TRIGGER IF EXISTS trg_clone_extra                 ON extras;
DROP TRIGGER IF EXISTS trg_clone_descuento             ON descuentos;
DROP TRIGGER IF EXISTS trg_clone_producto_sucursal     ON productos_sucursal;
DROP TRIGGER IF EXISTS trg_clone_catalog_new_sucursal  ON sucursales;
DROP FUNCTION IF EXISTS clone_servicio_to_sucursales();
DROP FUNCTION IF EXISTS clone_extra_to_sucursales();
DROP FUNCTION IF EXISTS clone_descuento_to_sucursales();
DROP FUNCTION IF EXISTS clone_producto_sucursal_to_others();
DROP FUNCTION IF EXISTS clone_catalog_to_new_sucursal();
DROP TABLE IF EXISTS servicios_sucursales;
DROP TABLE IF EXISTS extras_sucursales;
-- descuentos_sucursales NO se dropea.
```

---

# 10. Entregable

Una sola migración `supabase/migrations/<ts>_fase1_normalizacion_catalogo.sql` que ejecuta en orden:

1. CREATE `servicios_sucursales` + índices + trigger updated_at.
2. CREATE `extras_sucursales` + índices + trigger updated_at.
3. UNIQUE/índices/trigger updated_at de `descuentos_sucursales` (IF NOT EXISTS).
4. DELETE de `descuentos_sucursales`.
5. Backfill `servicios_sucursales` en orden A → C → B.
6. Backfill `extras_sucursales` en orden A → C → B.
7. Backfill `descuentos_sucursales`.
8. Backfill faltantes de `productos_sucursal`.
9. Funciones + triggers: `servicios`, `extras`, `descuentos`, `productos_sucursal` (con `pg_trigger_depth()` guard), `sucursales`.
10. RLS: ENABLE + 3 políticas por tabla (owner-GM SELECT, owner-GM ALL, manager+barber SELECT por sucursal). DROP previo en descuentos.
11. `COMMENT ON TABLE` describiendo cada tabla nueva.

Tras aplicar se corren §7 y se reporta el resultado. Si algo falla, se revierte con §9.
