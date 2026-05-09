
# Refactor Catálogo: Servicios, Extras, Descuentos, Líneas (v2)

Mantengo la estructura actual de los componentes. Solo agrego eliminación segura, validaciones y mejoras inline. No rediseño módulos.

## Convenciones confirmadas

- DB tipo descuento: `'porcentaje' | 'monto'`. UI: `'percentage' | 'fixed'`. Mapeo ya existe en `useSupabaseData.ts` (líneas ~112, 690, 739) y se respeta tal cual.
- Mapeos UI→DB que ya existen y NO cambio:
  - Servicio: `name→nombre`, `price→precio`, `durationMin→duracion_min`, `lineId→linea_id`.
  - Extra: `name→nombre`, `price→precio`.
  - Descuento: `label→nombre`, `value→valor`, `type→tipo` (mapeo arriba), `appliesTo→aplica_a`, etc.
  - Línea: `name→nombre`, `color→color`.
- Tablas hijas confirmadas existentes: `servicios_sucursales`, `extras_sucursales`, `descuentos_sucursales`. Solo se auditan los joins ya existentes; no se crean lógicas nuevas alrededor.

## 1. Migración

Agregar a `servicios`, `extras`, `descuentos`, `lineas`:

```sql
ALTER TABLE public.<t>
  ADD COLUMN eliminado boolean NOT NULL DEFAULT false,
  ADD COLUMN eliminado_at timestamptz NULL,
  ADD COLUMN eliminado_por uuid NULL;

CREATE INDEX <t>_org_not_deleted_idx
  ON public.<t> (organization_id) WHERE eliminado = false;
```

Triggers BEFORE INSERT/UPDATE (no CHECK constraints, según convención):

- Las cuatro tablas: `length(btrim(nombre)) BETWEEN 1 AND 80`.
- `descuentos`: si `tipo = 'porcentaje'` → `valor > 0 AND valor <= 100`.

RLS: sin cambios. El UPDATE para marcar eliminado lo cubre la policy de UPDATE existente (owner / general_manager / manager).

## 2. Eliminación segura

Función única en `useSupabaseData.ts`:

```ts
type DeletableTable = 'servicios' | 'extras' | 'descuentos' | 'lineas';
async function softDelete(table: DeletableTable, id: string) { ... }
```

- Allowlist estricta por tipo (no acepta strings arbitrarios).
- Antes de actualizar, valida en cliente que `activo === false` (defensa en profundidad; el botón ya está bloqueado en UI).
- Update único:
  ```
  { activo: false, eliminado: true, eliminado_at: now(), eliminado_por: auth.uid(), updated_at: now() }
  ```
- En NINGÚN punto del código se hace `.delete()` real sobre estas tablas. Buscar y confirmar que no quedan llamadas a `.delete()` sobre ellas.

## 3. Filtros de lectura

En todas las queries de las 4 tablas, agregar `.eq('eliminado', false)` (single source of truth tras la migración con default `false`; no usar `.is('eliminado', null)` porque la migración garantiza no-null).

Auditar en:

- `src/hooks/useSupabaseData.ts` (cargas iniciales y refrescos).
- `src/hooks/useSucursalCatalog.ts` (joins con `servicios`, `extras`, `descuentos`).
- `src/hooks/useBarbershopStore.ts` (re-export).
- Edge functions de booking público que listan servicios: `get-availability`, `get-org-public` — agregar `eliminado=false` al filtro.

El filtro UI Activos/Inactivos sigue funcionando solo sobre `activo`. Los eliminados nunca llegan al cliente, no se exponen filtros ni vistas para ellos.

## 4. UI — patrón común

Cada fila en cada lista:

```
[campos editables inline] [Switch Activo/Inactivo]  [Botón Eliminar]
```

- Botón Eliminar:
  - Si `activo === true` → `disabled` con tooltip: "Para eliminar este elemento, primero debes desactivarlo."
  - Si `activo === false` → habilitado.
- Solo visible para owner / general_manager / manager (mismo gate que el switch activo).
- Click abre `AlertDialog`:
  - Título: "Eliminar servicio" / "Eliminar extra" / "Eliminar descuento" / "Eliminar línea".
  - Descripción exacta:
    > "Este elemento dejará de aparecer en el sistema. No se modificarán los registros históricos donde ya haya sido utilizado. Esta acción no se podrá deshacer desde la interfaz."
  - Botones: "Cancelar" y "Eliminar".
- Tras confirmar: llamar `softDelete`, refrescar lista, toast de éxito según el tipo:
  - "Servicio eliminado correctamente."
  - "Extra eliminado correctamente."
  - "Descuento eliminado correctamente."
  - "Línea eliminada correctamente."

## 5. Cambios por componente

### `ServicesConfig.tsx`
- Inputs de nombre: `maxLength={80}`, `value.trim()` antes de guardar.
- Validar precio numérico ≥ 0; duración entera > 0.
- Botón eliminar con la regla anterior.
- Mensajes de error en español (ver §7).

### `ExtrasConfig.tsx` (incluye fix del bug de precio)
- `CurrencyInput` con estado local controlado: `const [draft, setDraft] = useState<number>(extra.price)`.
- Commit del precio en `onBlur` o al tocar Enter, llamando `onUpdate(extra.id, { price: draft })`. No recrear el extra.
- Verificar que el handler en `useSupabaseData` actualiza solo `precio` (no toca `nombre` ni otros). Mapeo `price→precio`.
- `maxLength={80}` en nombre, validar trim/no vacío, precio ≥ 0.
- Botón eliminar con la regla anterior.

### `DiscountsConfig.tsx`
- Mantener edición inline existente.
- Validación: si `type === 'percentage'` → `value > 0 && value <= 100`. Mensaje: "El porcentaje debe ser mayor a 0 y menor o igual a 100."
- Si `type === 'fixed'` → `value >= 0`.
- `maxLength={80}` en `label`, trim, no vacío.
- Botón eliminar con la regla anterior.

### Líneas
- En la sub-UI de líneas (dentro de ServicesConfig o sección dedicada que ya existe): permitir editar nombre y color inline, switch activo, botón eliminar.
- Cambiar el color de una línea se refleja en los servicios automáticamente porque la UI ya lee `linea.color` por relación. Verificar que ningún componente cachee `service.color` propio.
- Eliminar una línea **no toca** servicios:
  - No actualiza `servicios.linea_id` masivamente.
  - Servicios con `linea_id` apuntando a una línea eliminada → la UI muestra "Sin línea" y sin color (resolver lookup nullsafe). El servicio sigue existiendo y activo si lo estaba.
  - El `AlertDialog` de eliminar línea agrega una segunda línea aclaratoria: "Los servicios asociados seguirán existiendo y aparecerán como Sin línea."

## 6. Permisos

Sin cambios en RLS. La UI ya gateaba creación/edición; aplicar el mismo gate al botón Eliminar para que barberos no lo vean.

## 7. Textos visibles (todo en español)

Validaciones:
- "El nombre no puede estar vacío."
- "El nombre no puede superar los 80 caracteres."
- "El precio debe ser un número igual o mayor a 0."
- "La duración debe ser mayor a 0 minutos."
- "El porcentaje debe ser mayor a 0 y menor o igual a 100."

Tooltip botón Eliminar deshabilitado:
- "Para eliminar este elemento, primero debes desactivarlo."

Términos prohibidos en UI: soft delete, hard delete, entity, record, archived, deleted, restore, database, backend. No mostrar "eliminado" como estado ni crear filtros de eliminados.

Revisar placeholders, tooltips, toasts, mensajes de error, botones, labels y estados vacíos de los 4 componentes para garantizar español neutro.

## 8. Históricos

No se tocan ventas, ingresos ni snapshots. Los listados históricos siguen leyendo nombres/snapshots guardados. La eliminación solo afecta disponibilidad futura y visibilidad en configuración.

## 9. QA

Por cada entidad (servicio, extra, descuento, línea):
1. Crear, editar inline cada campo, desactivar.
2. Con activo: el botón Eliminar está deshabilitado y muestra el tooltip correcto.
3. Con inactivo: eliminar abre el diálogo, confirma, registro desaparece de Configuración, Cobrar, Agenda y selects.
4. Verificar que ventas anteriores siguen mostrando el nombre original.
5. Cambiar color de una línea y ver el cambio reflejado en todos los servicios asociados.
6. Eliminar una línea con servicios asociados: los servicios siguen existiendo y aparecen como "Sin línea".
7. Validaciones: nombre vacío, > 80 caracteres, precio negativo, duración 0, descuento porcentual 0 y 101.
8. Confirmar que ningún `.delete()` real se ejecuta sobre las 4 tablas (revisión de código + verificación en logs).

## Archivos a tocar

- Migración SQL (4 tablas + triggers de validación + índices parciales).
- `src/hooks/useSupabaseData.ts` — filtro `eliminado=false`, función `softDelete`, validaciones.
- `src/hooks/useSucursalCatalog.ts` — filtro `eliminado=false` en joins.
- `src/hooks/useBarbershopStore.ts` — exponer `deleteService/Extra/Discount/Line` (soft).
- `src/components/config/ServicesConfig.tsx` — botón eliminar, maxLength, validaciones.
- `src/components/config/ExtrasConfig.tsx` — fix precio inline + botón eliminar + validaciones.
- `src/components/config/DiscountsConfig.tsx` — validación porcentaje + botón eliminar.
- Sub-UI de Líneas (donde se gestione hoy) — editar inline + botón eliminar.
- `supabase/functions/get-availability` y `supabase/functions/get-org-public` — filtro `eliminado=false`.
- `src/integrations/supabase/types.ts` se regenera automáticamente tras migración.
