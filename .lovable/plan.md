
# Normalización de Descuentos (servicios + productos) — v2

Objetivo: separar descuentos de servicios y productos, dejar la base con activos/inactivos a nivel global y por sucursal, y guardar historial real de cada descuento aplicado en cada venta. Sin descuentos mixtos, sin descuentos por marca/producto, sin múltiples descuentos del mismo tipo en una venta.

Cambio clave respecto a la versión anterior: al crear un descuento queda activo por defecto en todas las sucursales de la organización. Si una sucursal no lo quiere usar, lo desactiva manualmente.

---

## 1. Cambios en base de datos

### 1.1 Tabla `descuentos`

- Mantener `aplica_a text not null default 'servicios'`.
- Agregar CHECK: `aplica_a IN ('servicios','productos')`.
- No agregar todavía columnas `eliminado / eliminado_at / eliminado_por`. Por ahora se usa solo `descuentos.activo` para inactivación global.
- `sucursal_id` queda como dato histórico/origen del descuento, pero ya no decide visibilidad. La visibilidad se resuelve por `descuentos_sucursales`. No se elimina la columna para no romper datos.

### 1.2 Nueva tabla `descuentos_sucursales`

```text
descuentos_sucursales
  id uuid pk default gen_random_uuid()
  organization_id uuid not null
  descuento_id uuid not null references descuentos(id) on delete cascade
  sucursal_id uuid not null references sucursales(id) on delete cascade
  activo boolean not null default true
  created_at timestamptz default now()
  updated_at timestamptz default now()
  unique (organization_id, descuento_id, sucursal_id)
```

- Default `activo = true`: cuando se crea un descuento, queda habilitado por defecto en todas las sucursales.
- Trigger `update_updated_at_column` para `updated_at`.
- RLS (igual que `descuentos`):
  - SELECT: cualquier usuario de la organización.
  - INSERT/UPDATE/DELETE: `owner`, `general_manager` o `manager` de la organización. Sin diferenciar por sucursal asignada para la activación/desactivación.

### 1.3 Backfill de descuentos existentes

Para cada descuento ya creado:

- Insertar una fila en `descuentos_sucursales` por cada sucursal de su organización con `activo = true`.
- Si el descuento tenía `descuentos.activo = false`, mantenerlo así (la fila por sucursal queda en true, pero el global apaga la visibilidad).

No se borra ningún descuento existente. No se reconstruye nada de ventas pasadas.

### 1.4 Nueva tabla `venta_descuentos_aplicados` (auditoría / snapshot)

```text
venta_descuentos_aplicados
  id uuid pk default gen_random_uuid()
  organization_id uuid not null
  sucursal_id uuid null
  venta_id uuid not null references venta(id) on delete cascade
  descuento_id uuid null references descuentos(id) on delete set null
  descuento_nombre text not null
  descuento_tipo text not null            -- 'porcentaje' | 'fijo'
  descuento_valor numeric not null default 0
  descuento_aplica_a text not null        -- 'servicios' | 'productos'
  subtotal_base numeric not null default 0
  monto_aplicado numeric not null default 0
  created_at timestamptz not null default now()
  check (descuento_aplica_a in ('servicios','productos'))
```

- Índices: `(venta_id)`, `(organization_id, sucursal_id, created_at)`, `(descuento_id)`.
- RLS: lectura por miembros de la organización; insert solo desde el flujo de cobro (validar `organization_id` del usuario y pertenencia de la venta).
- Solo se inserta una fila si efectivamente se aplicó un descuento (no insertar filas con `monto_aplicado = 0` por defecto).
- El snapshot se guarda al momento de la venta para que cambios futuros en el descuento (nombre, valor, desactivación) no afecten el histórico.

### 1.5 `venta.descuento_pct`

- No se elimina. Mantiene su semántica actual = descuento de servicios (porcentaje), por compatibilidad con cierres y reportes existentes.
- La fuente nueva de verdad para auditoría detallada es `venta_descuentos_aplicados`.

---

## 2. Lógica de creación de descuentos

Al crear un descuento (servicio o producto):

1. Insert en `descuentos` con `activo = true` y `aplica_a` correspondiente.
2. En la misma transacción / inmediatamente después, insertar una fila en `descuentos_sucursales` por cada sucursal de la organización, con `activo = true`.
3. UX esperada: “creo un descuento y ya lo puedo usar en cualquier sucursal”.

Si después se agrega una sucursal nueva a la organización, el plan no obliga aún a crear automáticamente filas para descuentos previos. Queda fuera de alcance esta vez (puede gestionarse desde el panel por sucursal).

---

## 3. Lógica de cálculo en Cobrar

Sin descuentos mixtos:

```text
subtotal_servicios = precio_servicio + suma(extras)
subtotal_productos = suma(venta_producto.subtotal)

descuento_servicios → solo sobre subtotal_servicios
descuento_productos → solo sobre subtotal_productos

subtotal_servicios_neto = subtotal_servicios - monto_desc_servicios
subtotal_productos_neto = subtotal_productos - monto_desc_productos

total_base = subtotal_servicios_neto + subtotal_productos_neto
total_cobrado = total_base + recargos_metodo_pago
```

- Reutilizar redondeo, `redondeo_unidad`, `tipo`, `metodo_pago` igual que hoy para ambos.
- Solo servicios → solo aparece selector de descuento de servicios.
- Solo productos → solo aparece selector de descuento de productos.
- Mixta → ambos bloques separados, cada uno con su propio descuento independiente.

Un descuento aparece en Cobrar si y solo si:

- `descuentos.activo = true`
- `descuentos_sucursales.activo = true` para la sucursal activa
- `aplica_a` corresponde al bloque (servicios o productos)
- `metodo_pago` compatible con el método elegido (igual que hoy)

---

## 4. Persistencia al cobrar

En el flujo de venta:

1. Insert de `venta` con `descuento_pct` = porcentaje del descuento de servicios (si fue porcentaje), igual que hoy. Si fue fijo, queda `descuento_pct = 0` y el detalle queda solo en la tabla nueva.
2. Insert de `venta_producto` como hoy, con `subtotal` ya neto del descuento de productos para mantener compatibilidad con `productos_total` neto en cierre.
3. Insert de `venta_pagos` como hoy.
4. Para cada descuento aplicado (0, 1 o 2 filas), insertar en `venta_descuentos_aplicados` el snapshot:
   - `descuento_id`, `descuento_nombre`, `descuento_tipo`, `descuento_valor`, `descuento_aplica_a`
   - `subtotal_base` (servicios o productos antes del descuento)
   - `monto_aplicado` ya redondeado según las reglas del descuento

Encapsular el insert en un helper para que anulación y cierre no requieran cambios estructurales.

---

## 5. UI — Mi Negocio > Descuentos

`src/components/config/DiscountsConfig.tsx` y `CobrarConfig.tsx`:

- Tabs internas:
  - **Servicios**
  - **Productos**
- Dentro de cada tab, dos secciones: **Activos** e **Inactivos** (basadas en `descuentos.activo`).
- Al crear un descuento:
  - Elegir `aplica_a` (Servicios o Productos). Sin opción mixta ni “toda la venta”.
  - Quedar activo globalmente (`descuentos.activo = true`) y activo en todas las sucursales (`descuentos_sucursales.activo = true`).
- Acciones por descuento:
  - Editar.
  - Desactivar / Reactivar (toggle `descuentos.activo`).
  - Sin botón de borrar físico.
- Panel **Disponibilidad por sucursal** (modal o sección expandible al editar el descuento):
  - Lista las sucursales de la organización con un switch por sucursal.
  - Cada switch refleja y modifica `descuentos_sucursales.activo` para esa sucursal.
  - Texto auxiliar: “Cuando creás un descuento se activa automáticamente en todas las sucursales. Apagá el switch para que no esté disponible en una sucursal específica.”
  - En organizaciones con una sola sucursal, ocultar o deshabilitar el panel.
- Copy auxiliar bajo el título del módulo: “Los descuentos se crean a nivel del negocio y por defecto quedan activos en todas las sucursales. Cada sucursal puede desactivarlo si no lo quiere usar.”
- Respetar tokens semánticos, sin emojis, `maxLength` 80 en nombre.

---

## 6. UI — Cobrar (`PaymentRegistration.tsx`)

- Detectar composición de la venta:
  - Hay servicio o extras → mostrar selector **Descuento servicios**.
  - Hay productos en el carrito → mostrar selector **Descuento productos**.
  - Mixta → mostrar ambos bloques separados, cada uno con su propio “Sin descuento”.
- Cada selector lista solo descuentos que cumplan los filtros descritos en la sección 3.
- El selector de descuento de productos reemplaza el TODO existente (`enrutar a un step de descuento de productos`).
- Actualizar copy del paso “discount” actual: pasar de “(solo servicios)” a textos dinámicos según corresponda.

---

## 7. Tipos / hooks

- `src/types/barbershop.ts`:
  - Agregar `appliesTo: 'servicios' | 'productos'` a `Discount`.
  - Agregar en `Transaction` un array opcional `appliedDiscounts` con el snapshot insertado en `venta_descuentos_aplicados`.
- `src/hooks/useSupabaseData.ts`:
  - Fetch de descuentos: traer `aplica_a` y joinear con `descuentos_sucursales` para la sucursal activa. Exponer dos listas: `serviceDiscounts`, `productDiscounts`, ya filtradas por activo global + activo en sucursal + método de pago.
  - `addDiscount`: tras insertar en `descuentos`, insertar `descuentos_sucursales` (una fila por cada sucursal de la organización) con `activo = true`.
  - Reemplazar `deleteDiscount` por `setDiscountActive(id, activo)` (toggle global). Mantener nombre `onDelete` apuntando al toggle por compatibilidad.
  - Nuevo método `setDiscountSucursalActivo(descuentoId, sucursalId, activo)`.
- `src/hooks/useTransactions.ts`:
  - Calcular y persistir snapshots según la nueva lógica.

---

## 8. Compatibilidad con cierre de caja

- `ingresos` y agregados de servicios (`cantidad_de_20_por`, `cantidad_de_50_por`, `servicios_con_descuento`, `servicios_sin_descuento`, `perdida`) se siguen calculando como hoy a partir de `venta.descuento_pct`.
- Productos en cierre: `productos_total`, `productos_cantidad`, `productos_efectivo`, `productos_digital` ya existen. El descuento de productos queda reflejado porque `venta_producto.subtotal` se guarda neto del descuento de productos (ver sección 4). Así el cierre muestra el ingreso real por productos sin necesidad de cambios estructurales en cierre.
- Detalle granular de descuentos queda en `venta_descuentos_aplicados` para reportes futuros.

---

## 9. Migración / pasos de despliegue

1. Migración SQL:
   - Alterar `descuentos`: agregar CHECK en `aplica_a`.
   - Crear `descuentos_sucursales` con RLS, trigger `updated_at` e índices.
   - Backfill: insertar relaciones para descuentos existentes con `activo = true` (ver 1.3).
   - Crear `venta_descuentos_aplicados` con RLS e índices.
2. Frontend:
   - Tipos y hooks.
   - UI Mi Negocio > Descuentos (tabs + panel sucursales).
   - UI Cobrar (dos selectores y cálculo separado).
   - Persistencia del snapshot en cada venta.

---

## 10. Fuera de alcance (explícito)

- Descuentos mixtos / “toda la venta”.
- Descuentos por marca o por producto específico.
- Múltiples descuentos del mismo tipo en la misma venta.
- Borrado físico, soft delete con columnas dedicadas (`eliminado / eliminado_at / eliminado_por`).
- Cambios en comisiones.
- Reportes/dashboard de descuentos.
- Auto-creación de filas en `descuentos_sucursales` cuando se crea una sucursal nueva.

---

## 11. Resumen de archivos a crear/editar

Migraciones SQL:
- Alterar `descuentos` (CHECK).
- Crear `descuentos_sucursales` + RLS + trigger + backfill.
- Crear `venta_descuentos_aplicados` + RLS + índices.

Frontend:
- `src/types/barbershop.ts`
- `src/hooks/useSupabaseData.ts`
- `src/hooks/useTransactions.ts`
- `src/components/config/DiscountsConfig.tsx`
- `src/components/config/CobrarConfig.tsx`
- `src/components/PaymentRegistration.tsx`

Resultado: descuentos separados por tipo, activos por defecto en todas las sucursales al crearlos, con desactivación manual por sucursal cuando haga falta, y con historial completo y consultable de cada aplicación en `venta_descuentos_aplicados`.
