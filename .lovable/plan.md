# Fix: Ventas sin sucursal_id

## El problema en simple

Cuando tu empleado registra un corte, el sistema debería guardar "este corte es de Casa Central". Pero por un bug en el código, esa etiqueta no se guarda — queda vacía. Después, cuando el sistema busca "mostrame los cortes de Casa Central", esos cortes sin etiqueta no aparecen. No se perdieron, están en la base de datos, pero sin la etiqueta de sucursal.

## Qué vamos a hacer

### 1. Corregir el registro de ventas nuevas

En `src/hooks/useTransactions.ts`, la función que guarda ventas tiene un bug: usa una referencia vieja de la sucursal (que queda en `null`). Se corrige agregando `currentSucursal` a las dependencias del `useCallback` (línea 184). Además, si por algún motivo no hay sucursal seleccionada, el sistema bloqueará el registro y mostrará un mensaje de error pidiendo seleccionar una sucursal.

### 2. Reparar los 29 cortes existentes sin sucursal

Ejecutar un UPDATE en la base de datos para asignarles la sucursal correcta (Casa Central = `ca6babf5-4d85-44c3-86b7-f8cd2c25a4da`) a todas las ventas que tienen `sucursal_id` nulo dentro de tu organización.

### Mantener el filtro estricto

El filtro de lectura queda como está: `.eq('sucursal_id', currentSucursal.id)` — sin tolerancia para nulos. Una vez reparados los datos y corregido el insert, no debería haber más ventas sin sucursal.

## Archivos a modificar

- `src/hooks/useTransactions.ts` — fix dependencias + bloqueo si no hay sucursal
- SQL data update — backfill de `sucursal_id` en ventas existentes