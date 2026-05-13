## Causa

En `src/components/DailySummary.tsx` (línea 80):

```ts
const canVoidClosure = isOwner || isManager;
```

La Cuenta de sucursal (`isSucursalAccount`) no entra en esa condición, así que el botón "Anular Cierre" nunca se renderiza, aunque el flujo ya pasa por `requirePinForAction('anular_cierre_caja', currentSucursal?.id ?? null)` en `handleVoidClosure` (línea 391).

El permiso real lo controla el PIN del actionKey `anular_cierre_caja`, que ya está definido en `sucursalActions.ts` y por defecto requiere PIN para cuentas de sucursal. La UI debe mostrar el botón y dejar que el gate de PIN decida.

## Cambio

Archivo único: `src/components/DailySummary.tsx`.

1. Tomar `isSucursalAccount` desde `useAuth()` (línea 79).
2. Actualizar la condición:

```ts
const canVoidClosure = isOwner || isManager || isSucursalAccount;
```

Nada más. No se toca `canBackfill` (regularizar día sigue restringido a owner/manager según criterio actual), ni el flujo de `handleVoidClosure`, ni `sucursalActions.ts`, ni RLS, ni edge functions.

## Verificación esperada

- Cuenta de sucursal entra a Caja → ve "Anular Cierre" en cierres existentes.
- Al hacer click, se pide PIN vía `anular_cierre_caja`.
- Owner/manager mantienen el comportamiento actual sin cambios.

## Riesgo

Mínimo. Un solo cambio de condición en un componente. La autorización real sigue protegida por PIN + RLS de la edge function de anulación.