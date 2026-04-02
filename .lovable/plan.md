

## Resumen

Dos problemas: (1) al asignar "Encargado de Sucursal" desde el panel de Equipo, no se crea el registro en `user_sucursales`, por lo que el manager no ve sucursales; (2) el PIN se guarda pero falla al validar, probablemente porque `currentSucursal` es `null` (consecuencia del problema 1) y `validate-pin` rechaza a no-globales sin sucursal.

## Problema 1: Sucursal no asignada al cambiar rol a manager

**Causa**: `handleChangeRoles` en `EquipoUnificado.tsx` (línea 171) solo inserta/elimina en `user_roles`, pero nunca toca `user_sucursales`. Cuando un manager se logea, la RLS de `sucursales` requiere que exista un registro en `user_sucursales` → no ve nada.

**Fix en `EquipoUnificado.tsx`**:
- Cuando se agrega el rol `manager`, solicitar la sucursal (ya se conoce: es la sucursal actual del tab donde se está trabajando, pasada como prop `sucursalId`).
- Insertar en `user_sucursales` con `user_id`, `sucursal_id`, `organization_id`.
- Actualizar `profiles.default_sucursal_id`.
- Cuando se remueve el rol `manager`, eliminar el registro de `user_sucursales` correspondiente.

**También para barbers**: cuando se invita un barbero, el `invite-user` ya maneja `user_sucursales`, pero cuando se cambian roles desde el checkbox sin pasar por invite, hay que garantizar que también se asigne la sucursal. Agregar la misma lógica para `barber`.

## Problema 2: PIN se crea pero "PIN incorrecto" al validar

**Causa raíz probable**: Si `user_sucursales` está vacío (problema 1), `SucursalContext` no carga sucursales → `currentSucursal` es `null` → `usePinProtection` envía `sucursal_id: null` a `validate-pin` → la función rechaza con "Este PIN no tiene acceso global" (pero el UI muestra el fallback "PIN incorrecto").

**Fix**: Solucionar el problema 1 debería resolver el 2 en cascada. Adicionalmente:

1. En `PinProtectedSection.tsx`: mostrar el error real de `validate-pin` en vez del genérico. Actualmente línea 40 usa `result.error || 'PIN incorrecto'` — el error del servidor debería llegar correctamente, pero verificar que `usePinProtection.validatePin` propague `data.error` siempre.

2. En `validate-pin/index.ts`: para el caso de primer login donde el usuario aún no tiene sucursal asignada, buscar la sucursal del barbero directamente y usarla como fallback si `sucursal_id` no viene en el request.

## Visualizar sucursal asignada

**En `AppSidebar.tsx` o `SucursalSelector.tsx`**: para managers y barbers que solo tienen 1 sucursal asignada, mostrar el nombre de la sucursal como badge o texto informativo (sin dropdown, ya que no pueden cambiar).

## Archivos a modificar

1. **`src/components/config/EquipoUnificado.tsx`** — `handleChangeRoles`: al agregar manager/barber, insertar en `user_sucursales` y setear `default_sucursal_id`
2. **`supabase/functions/validate-pin/index.ts`** — fallback: si `sucursal_id` es null y el barbero tiene `sucursal_id`, usar esa
3. **`src/components/PinProtectedSection.tsx`** — mostrar error real del servidor
4. **`src/components/SucursalSelector.tsx`** — mostrar sucursal fija para barbers/managers sin opción de cambio

