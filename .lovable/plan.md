

## Resumen del problema

Es el mismo tipo de bug que ya corregimos con el registro de ventas: el cierre diferido ("Regularizar día") guarda los datos en la base de datos **sin la etiqueta de sucursal** (`sucursal_id`). Después, cuando entrás a Sueldos o volvés al resumen del día, el sistema filtra por sucursal y esos cierres "no existen" porque no tienen sucursal asignada.

Es decir: los datos están guardados, pero son invisibles porque les falta la etiqueta de a qué sucursal pertenecen.

---

## Detalle técnico

### Cambio 1: `src/hooks/useBackfillClosing.ts` — agregar `sucursal_id` al insert

En el objeto `insertData` (línea 100), falta `sucursal_id`. Hay que agregarlo usando `currentSucursal` del `SucursalContext`.

- Importar `useSucursal`
- Obtener `currentSucursal`
- Agregar `sucursal_id: currentSucursal?.id || null` al objeto de insert (línea ~127)
- Agregar `currentSucursal` a las dependencias del `useCallback` (línea 173)
- Bloquear el guardado si no hay sucursal seleccionada (mismo patrón que `addTransaction`)

### Cambio 2: Backfill de datos existentes (SQL)

Ejecutar un UPDATE para asignar la sucursal correcta a los cierres diferidos que ya se