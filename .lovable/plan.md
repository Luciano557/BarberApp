

# Aislar datos por sucursal para Encargados de Local

## Problema

Hay dos problemas principales:

1. **Barberos no se filtran por sucursal**: `useSupabaseData` trae TODOS los barberos de la organización sin importar la sucursal actual. Un encargado de local ve barberos de otras sucursales.

2. **El encargado de local puede cambiar de sucursal**: El `SucursalSelector` muestra todas las sucursales que devuelve RLS. Aunque RLS en `sucursales` filtra por `user_sucursales`, el selector no impide que un manager cambie a otra sucursal si tiene acceso. Además, no se bloquea el cambio de sucursal en el frontend para managers.

3. **Ventas/ingresos**: `useTransactions` sí filtra por `currentSucursal`, pero si el manager puede cambiar de sucursal, accede a datos de otra.

## Cambios

### 1. `useSupabaseData.ts` — Filtrar barberos por `sucursal_id`

Cuando hay `currentSucursal` seleccionada, la query de barberos debe incluir `.eq('sucursal_id', currentSucursal.id)`. También re-fetchear cuando cambie la sucursal (agregar `currentSucursal` como dependencia del `useCallback`).

Los datos "all" (para configuración) seguirán sin filtrar para owners/GMs, pero los datos operativos (`barbers`, `services`, etc.) se filtrarán por sucursal.

### 2. `SucursalSelector.tsx` — Ocultar selector para managers

Si el usuario es `manager` (no owner ni GM), no mostrar el selector de sucursales. El manager queda fijado a su sucursal asignada y no puede cambiar.

### 3. `SucursalContext.tsx` — Bloquear cambio para managers

En `setCurrentSucursal`, si el usuario no es owner ni GM, ignorar el cambio. Así se previene cualquier manipulación.

### 4. `useSupabaseData.ts` — Re-fetch al cambiar sucursal

Agregar `currentSucursal?.id` como dependencia del `fetchData` callback para que los datos se recarguen al cambiar de sucursal.

### 5. Barberos RLS — Filtrar por sucursal para managers

Actualizar la política RLS de `barberos` para managers: agregar condición `sucursal_id IN (SELECT sucursal_id FROM user_sucursales WHERE user_id = auth.uid())` para que a nivel de base de datos también se restrinja.

## Archivos a modificar

- `src/hooks/useSupabaseData.ts` — filtrar barberos por sucursal_id, agregar dependencia de currentSucursal
- `src/components/SucursalSelector.tsx` — ocultar para managers
- `src/contexts/SucursalContext.tsx` — bloquear cambio de sucursal para managers
- **Migración SQL** — actualizar RLS de barberos para managers filtrando por sucursal

