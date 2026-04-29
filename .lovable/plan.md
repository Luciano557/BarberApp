
# Módulo Productos — Plan v2 (con ajustes aprobados)

## Resumen de cambios respecto al plan anterior

1. Ventas solo-producto sin barbero → "venta general de sucursal" sin contaminar cierres individuales ni comisiones.
2. Stock inicial siempre genera movimiento `stock_inicial` en bitácora.
3. Anulación de ventas con productos: advertencia explícita; sin reposición automática. Acción "Devolver producto" visible como "Próximamente".
4. Descuentos siguen aplicando solo a servicios/extras. Productos no reciben descuento en esta fase.
5. Migración: descuentos existentes quedan marcados con `aplica_a = 'servicios'`.
6. Todo lo demás del plan v1 se mantiene.

---

## 1. Tablas nuevas (sin cambios respecto a v1)

- `marcas_producto` (org)
- `productos` (org)
- `productos_sucursal` (org + sucursal, stock, precios)
- `movimientos_stock` (bitácora inmutable)
- `venta_producto` (ítems producto en una venta)
- `ingresos_items_productos` (detalle por cierre)

Detalles de columnas, RLS y constraints igual que v1.

## 2. Cambios en tablas existentes

### `venta`
- `servicio_id`, `precio_servicio` → permitir `NULL` (venta solo-productos).
- Nueva columna `tipo_venta text default 'mixta'` (`'servicio' | 'productos' | 'mixta'`).
- **`barbero_id` → permitir `NULL`** únicamente cuando `tipo_venta = 'productos'`. Validación vía trigger:
  - si `tipo_venta IN ('servicio','mixta')` ⇒ `barbero_id` obligatorio (regla actual).
  - si `tipo_venta = 'productos'` ⇒ `barbero_id` puede ser `NULL` (= venta general de sucursal).
- `barbero_nombre` también nullable bajo la misma regla.

### `ingresos`
- Snapshots separados de productos (no contaminan facturación comisionable):
  - `productos_total numeric default 0`
  - `productos_cantidad integer default 0`
  - `productos_efectivo numeric default 0`
  - `productos_digital numeric default 0`
- Estas columnas suman a `total_cobrado` / `efectivo_cobrado` / `digital_cobrado` (arqueo real) pero **no** a `total_facturado` / `mp` / `efectivo` / `sueldo`.

### `descuentos` (NUEVO en v2)
- Agregar `aplica_a text not null default 'servicios'` con check `aplica_a IN ('servicios')` por ahora (extensible a `'productos'`/`'mixto'` en futuro).
- Migración de datos: `UPDATE descuentos SET aplica_a = 'servicios'` para todas las filas existentes.
- UI de descuentos: oculta el selector hasta que haya más de un valor posible (no agrega ruido en esta fase). Validación a nivel app: descuentos no se ofrecen sobre ítems de producto.

## 3. "Venta general de sucursal" — solución segura (ajuste #1)

**Decisión**: una venta con `tipo_venta = 'productos'` y sin vendedor seleccionado se guarda con `barbero_id = NULL` y `barbero_nombre = NULL`. El cierre la procesa así:

- **Cierre individual de barbero** (`useCashClosing.saveCashClosing`) — filtra `tx.barberId === barber.barberId`. Las ventas con `barbero_id IS NULL` quedan **fuera** automáticamente. No suman a `total_facturado`, ni a `sueldo`, ni a `productos_*` del barbero.
- **Cierre general de sucursal** — al cerrar el día se ejecuta una función adicional `cerrar_ventas_generales_sucursal(_sucursal_id, _fecha)` que:
  - busca todas las ventas del día con `barbero_id IS NULL` y `sucursal_id = _sucursal_id`, no anuladas, no incluidas previamente en ningún cierre.
  - inserta UN row en `ingresos` con `barbero_id = NULL`, `barbero = 'Venta general de sucursal'`, todos los campos de servicios en 0, y los snapshots de `productos_*` con la suma del día.
  - inserta los `ingresos_items_productos` correspondientes con `barbero_id = NULL`.
  - graba `entry_mode = 'venta_general_sucursal'` para distinguirlo en historial.
- **RLS y permisos**: `ingresos` ya admite `barbero_id NULL` (es nullable). Las políticas actuales (`Owner GM and manager can view org ingresos`) ya cubren ese caso. La policy de barber (`barbero_id = get_user_barbero_id`) lo excluye automáticamente, por lo que barbers no ven estos cierres.
- **UI de cierre**: en la pantalla de cierre del día aparece "Venta general de sucursal" como una tarjeta separada del listado de barberos, accionable solo por owner/GM/manager.
- **Comisiones / sueldos**: completamente intactos. Estas ventas nunca entran al cómputo de ningún barbero.

Esto evita inventar un "barbero ficticio" y mantiene RLS, comisiones y reportes históricos sin contaminar.

## 4. Stock inicial (ajuste #2)

Al crear un producto o al activarlo en una sucursal con stock inicial > 0, **no se setea `stock_actual` directamente**. Se llama a la RPC:

```text
registrar_movimiento_stock(
  _producto_sucursal_id,
  _tipo := 'stock_inicial',
  _cantidad := <stock inicial>,
  _motivo := 'Stock inicial al crear producto',
  _venta_id := NULL
)
```

La RPC (SECURITY DEFINER):
1. Valida org/sucursal/permisos del caller (owner/GM o manager-de-sucursal).
2. Lee `stock_previo` con `SELECT ... FOR UPDATE`.
3. Inserta en `movimientos_stock`:
   - `tipo = 'stock_inicial'`
   - `cantidad = <inicial>`
   - `stock_previo = 0`
   - `stock_resultante = <inicial>`
   - `created_by = auth.uid()`
4. Actualiza `productos_sucursal.stock_actual = stock_resultante`.

Misma RPC se reutiliza para `reposicion`, `ajuste_manual` y `venta` (esta última disparada al confirmar venta). Para `ajuste_manual`, `cantidad` es el delta (positivo o negativo) y `motivo` es obligatorio.

El historial empieza desde el primer movimiento registrado, por lo tanto siempre desde la creación.

## 5. Anulación de ventas con productos (ajuste #3)

- En `voidTransaction` (existente, soft delete sobre `venta`): **no se toca el stock**. La política se mantiene tal cual hoy.
- En el `VoidTransactionDialog`, si la venta contiene `venta_producto`:
  - mostrar bloque destacado (variant warning) con el texto:
    > "Esta anulación no repone stock automáticamente. Ajustá el stock manualmente si corresponde."
  - listar los productos involucrados (nombre, cantidad) para que el usuario sepa qué ajustar después.
- En la card del producto dentro del detalle de la venta anulada, agregar acción **"Devolver producto"** deshabilitada con badge **"Próximamente"** (tooltip: "Disponible en una próxima versión").
- En `Mi Negocio > Productos > Historial de movimientos`, no se generan filas por anulaciones (consistente con que no hay reposición automática).

## 6. Descuentos y productos (ajustes #4 y #5)

### En la venta
- El descuento (servicio + extras) se calcula como hoy, **solo sobre `precio_servicio + Σ precio_extra`**.
- Cálculo del total final de la venta:

```text
subtotal_servicios = precio_servicio + Σ(venta_extra)
descuento_aplicado = subtotal_servicios * descuento_pct / 100   (o monto fijo, según tipo)
subtotal_productos = Σ(venta_producto.subtotal)                  (sin descuento)

total_base    = (subtotal_servicios − descuento_aplicado) + subtotal_productos
total_pagado  = total_base + recargos por método de pago
```

- `venta_pagos` distribuye `total_pagado` entre métodos como hoy.
- `useCashClosing` ya separa pagos por método; al recorrer `venta_producto` los suma a `productos_*` y a `*_cobrado`, sin tocar `total_facturado`/`mp`/`efectivo`/`sueldo`.

### Migración de descuentos existentes
- Migración SQL:
  ```text
  ALTER TABLE descuentos ADD COLUMN aplica_a text NOT NULL DEFAULT 'servicios';
  ALTER TABLE descuentos ADD CONSTRAINT descuentos_aplica_a_chk CHECK (aplica_a IN ('servicios'));
  -- el DEFAULT garantiza migración explícita; UPDATE de seguridad por idempotencia
  UPDATE descuentos SET aplica_a = 'servicios' WHERE aplica_a IS NULL OR aplica_a = '';
  ```
- En código TypeScript: `Discount` recibe `aplicaA: 'servicios'` (literal por ahora). El selector en cobrar nunca ofrece descuentos sobre productos; los productos no muestran selector de descuento.

## 7. Permisos / RLS (igual que v1)

- `marcas_producto`, `productos`: SELECT org; ALL owner/GM/manager.
- `productos_sucursal`: SELECT org (manager y barber filtrados por `get_user_sucursal_ids`); INSERT/UPDATE owner/GM y manager-de-sucursal.
- `movimientos_stock`: SELECT owner/GM/manager (manager limitado a sus sucursales); INSERT vía RPC SECURITY DEFINER; sin UPDATE/DELETE.
- `venta_producto`: igual a `venta_extra`.
- `ingresos_items_productos`: igual a `ingresos_items`.
- RPC `registrar_movimiento_stock` valida internamente el rol según `_tipo`:
  - `stock_inicial` / `reposicion` / `ajuste_manual` → owner/GM, o manager con `_sucursal_id IN get_user_sucursal_ids`.
  - `venta` → cualquier rol con permiso de Cobrar en la sucursal, exige existencia de la venta.

## 8. Impacto en Cobrar (igual a v1, con ajuste de descuento)

- Botón secundario "Agregar producto" abre selector con catálogo activo.
- Carrito separado: sección Productos (no entra al flujo de servicios).
- Selector de barbero opcional cuando `tipo_venta = 'productos'`. Si vacío → "Venta general de sucursal" visible en el resumen.
- Stock bajo (badge ámbar), stock insuficiente (AlertDialog con texto sugerido, permite continuar).
- Edición de precio unitario solo owner/GM/manager.
- Mixta → producto hereda barbero del servicio (no editable v1).
- Confirmar venta: insert `venta` + `venta_extra` + `venta_producto` + `venta_pagos`; RPC `registrar_movimiento_stock` por cada producto (`tipo='venta'`, cantidad negativa, link a `venta_id`).

## 9. Impacto en Caja / cierre (con ajuste #1)

- `useCashClosing.saveCashClosing` (cierre individual del barbero):
  - Lee `venta_producto` filtrando por `barbero_id = barber.barberId` (excluye automáticamente las ventas generales).
  - Calcula y graba `productos_total/cantidad/efectivo/digital` y filas en `ingresos_items_productos`.
- Nueva función `cerrar_ventas_generales_sucursal(_sucursal_id, _fecha)`:
  - Disparable manualmente o al cerrar el último barbero del día (decisión UX: botón explícito "Cerrar venta general de sucursal" en la pantalla de cierre).
  - Procesa solo ventas con `barbero_id IS NULL` no incluidas aún.
- Pantalla de cierre del día muestra dos secciones: "Cierres de barberos" y "Venta general de sucursal" (solo visible para owner/GM/manager).
- Historial de cierres: filas con `barbero_id IS NULL` se renderizan con etiqueta "Venta general de sucursal".

## 10. UI Mi Negocio > Productos (sin cambios respecto a v1)

- Tab "Productos" dentro de `CobrarConfig` (junto a Servicios/Extras/Descuentos).
- Lista con buscador, filtros (marca, activo/inactivo, stock bajo).
- Form producto: nombre, marca (combobox + crear rápido con color auto), descripción, precio costo (opcional), precio venta, margen sincronizado (regla 1 y 2 del usuario), stock inicial, stock mínimo.
- Detalle: switch activo por sucursal, agregar/ajustar stock (RPC), historial de movimientos (drawer con timeline).
- Sheet Marcas: list + form con color picker (auto si vacío).

## 11. Riesgos y mitigaciones (actualizado)

| Riesgo | Mitigación |
|---|---|
| `venta.barbero_id` hoy probablemente NOT NULL | Migración `ALTER COLUMN ... DROP NOT NULL` + trigger que lo exige cuando `tipo_venta != 'productos'`. |
| RLS de barber leyendo ventas generales | `barbero_id IS NULL` no matchea `barbero_id = get_user_barbero_id(...)`, queda fuera por construcción. |
| Doble inclusión de venta general en distintos cierres | Tabla `ingresos_items_productos` referencia `ingreso_id`. La RPC `cerrar_ventas_generales_sucursal` excluye ventas ya vinculadas a algún ingreso. |
| Anulación deja stock inconsistente | Advertencia explícita + acción manual; "Devolver producto" como Próximamente para señalar la solución futura. |
| Descuento confunde al usuario en venta mixta | UI muestra subtotales separados: "Servicios y extras (con descuento)" y "Productos". |
| Concurrencia de stock | `UPDATE ... RETURNING` dentro de la RPC con `FOR UPDATE` sobre `productos_sucursal`. |

## 12. Fases

**Fase 1 (este pedido):**
1. Migración: tablas nuevas, columnas en `ingresos`, `tipo_venta` + nullables en `venta`, `aplica_a` en `descuentos` (default + UPDATE), trigger de `venta`, RPCs `registrar_movimiento_stock` y `cerrar_ventas_generales_sucursal`, RLS.
2. Mi Negocio → tab Productos + Marcas + CRUD + activar por sucursal + stock inicial vía RPC + agregar/ajustar stock + historial.
3. Cobrar → botón "Agregar producto", carrito de productos, validaciones, edición de precio por rol, vendedor opcional en solo-productos, descuentos solo a servicios/extras.
4. `useTransactions.addTransaction` → escribe `venta_producto`, setea `tipo_venta`, `barbero_id` puede ser NULL en solo-productos, RPC de movimiento por cada ítem.
5. `useCashClosing` → snapshots de productos por barbero + nueva acción "Cerrar venta general de sucursal".
6. Vista de cierre/historial → sección "Productos vendidos" + tarjeta "Venta general de sucursal".
7. `VoidTransactionDialog` → bloque de advertencia + acción "Devolver producto" (Próximamente).

**Fase 2 (futuro):**
- Devolución real de productos con reposición de stock.
- Comisión por venta de productos.
- Descuentos sobre productos (extender check `aplica_a IN ('servicios','productos','mixto')`).
- Detalle por marca en cierre y reportes.
- Alertas automáticas de stock mínimo.
- Importación CSV, SKU, código de barras, proveedores.

---

¿Procedo a implementar la Fase 1 con estos ajustes?
