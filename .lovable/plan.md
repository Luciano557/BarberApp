

## Resumen

3 cambios: fix barbero fantasma en booking, agregar duración en servicios, eliminar buffer antes.

## Problema 1: Barbero desactivado aparece en reservas

**Causa raíz**: Hay un registro duplicado de "Luciano Garcia" con `sucursal_id = NULL` y `activo = true` (id: `0ee9bdb5`). En `BookingStepper.tsx` línea 238, el filtro `b.sucursal_id === booking.sucursalId || !b.sucursal_id` incluye barberos sin sucursal en TODAS las sucursales.

**Fix en 2 puntos**:

1. **`supabase/functions/get-org-public/index.ts`** — agregar filtro `.not('sucursal_id', 'is', null)` en la query de barberos. Un barbero sin sucursal asignada no debería ser reservable.

2. **`BookingStepper.tsx` línea 238** — cambiar filtro a solo `b.sucursal_id === booking.sucursalId` (sin el fallback `|| !b.sucursal_id`). Esto es defensa en profundidad.

3. **Limpiar dato huérfano** — desactivar el registro `0ee9bdb5` que tiene `sucursal_id = NULL` vía update directo.

## Problema 2: Agregar duración por servicio

**Cambios**:

1. **`src/types/barbershop.ts`** — agregar `durationMin?: number` al tipo `Service`

2. **`src/hooks/useSupabaseData.ts`**:
   - `dbToService`: mapear `row.duracion_min` a `durationMin`
   - `addService`: incluir `duracion_min: service.durationMin || 30` en el insert
   - `updateService`: mapear `durationMin → duracion_min` en updates

3. **`src/components/config/ServicesConfig.tsx`**:
   - Agregar state `newDuration` (default `'30'`)
   - En formulario de agregar y editar: agregar input numérico "Duración (min)" con validación (mínimo 5, obligatorio)
   - En la lista de servicios: mostrar duración junto al precio (ej: "30 min")
   - Validación: no permitir guardar sin duración

## Problema 3: Eliminar buffer antes

**Cambios**:

1. **`src/components/config/AgendaConfigSection.tsx`**:
   - Eliminar `buffer_antes_min` del interface `ConfigData` y de `DEFAULTS`
   - Eliminar la entrada del array `fields` que corresponde a buffer antes
   - En `handleSave`: forzar `buffer_antes_min: 0` en el upsert para no romper el schema

2. **`supabase/functions/get-availability/index.ts`**:
   - Hardcodear `bufferBefore = 0` o simplemente ignorar `buffer_antes_min` del config
   - Limpiar la lógica de slot generation que usa `bufferBefore` (simplificar sin eliminarlo para no romper si se reactiva)

## Orden

1. Fix barbero fantasma (get-org-public + BookingStepper + data cleanup)
2. Duración en servicios (types + hook + UI)
3. Eliminar buffer antes (AgendaConfig UI + edge function)

