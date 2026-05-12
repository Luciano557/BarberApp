# Fase 3 — Confirmación de visibilidad + limpieza técnica en DailySummary

## Estado funcional verificado

La parte funcional de Fase 3 ya está cubierta por código existente:

- `AuthContext`: `canViewMiNegocio = (isOwner || isGeneralManager || isManager) && !isSucursalAccount`, y `canManageConfig = isOwner || isGeneralManager`. Cuenta de sucursal queda fuera de Mi Negocio y Configuración.
- `AppSidebar` arma el menú a partir de esos flags, así que para `sucursal_account` solo aparecen Cobrar, Caja, Finanzas, Tareas, Turnos y Clientes. Mi Negocio y Configuración no se renderizan.
- `FinanzasPanel` tiene rama dedicada para `isSucursalAccount` que solo muestra las tabs Gastos y Sueldos.
- Caja, Finanzas y Turnos abren sin PIN. Las acciones sensibles siguen pasando por `requirePinForAction` con los actionKeys ya existentes.

No hay cambios funcionales pendientes en estos archivos.

## Cambios a aplicar

Archivo único: `src/components/DailySummary.tsx`.

### 1. Reemplazar `useMemo` por `useEffect`

Líneas 150–152:

```ts
useMemo(() => {
  checkClosedBarbers();
}, [checkClosedBarbers]);
```

Pasa a:

```ts
useEffect(() => {
  checkClosedBarbers();
}, [checkClosedBarbers]);
```

`useEffect` ya está importado. `checkClosedBarbers` consulta Supabase y actualiza estado, así que corresponde un efecto, no un memo.

### 2. Eliminar código muerto del historial de anulaciones

Verificado en el archivo:

- Línea 79: `const [anulacionesHistoryOpen, setAnulacionesHistoryOpen] = useState(false);` — declarado y nunca leído por el JSX.
- Línea 381: `handleAnulacionesHistoryClick` (useCallback con `requirePinForAction('ver_historial_caja', …)` que setea `setAnulacionesHistoryOpen(true)`) — nunca se enlaza a ningún botón.
- Línea 538: `<AnulacionesCierreHistory barbers={barbers} />` — se renderiza directamente, no controlado por ese estado.

Eliminar:

- La declaración del `useState` (línea 79).
- El `useCallback` completo de `handleAnulacionesHistoryClick`.

No tocar:

- El render `<AnulacionesCierreHistory barbers={barbers} />`.
- El import de `AnulacionesCierreHistory`.

### 3. No reintroducir imports muertos

Mantener limpio: no deben volver a aparecer `PaymentMethod`, `Alert`, `AlertDescription`, `AlertTitle`.

## Lo que NO se toca

`AuthContext`, `AppSidebar`, `FinanzasPanel`, `ActionPinGate`, `requirePinForAction`, `validate-pin`, `set-pin`, `user_pins`, RLS, edge functions, modelo de roles, métodos de pago, `sucursalActions.ts`, actionKeys existentes, auditoría, inserts a `anulaciones_cierre`, ni el componente `AnulacionesCierreHistory`.

No se agregan actionKeys nuevos. No se agrega `regularizar_dia_caja`. No se modifica el flujo de Regularizar día.

ActionKeys de Caja en `DailySummary` se mantienen tal cual: `cerrar_caja`, `anular_transaccion`, `anular_cierre_caja`, `regularizar_cierre_caja`, `ver_historial_caja`.

## Confirmaciones a entregar

1. Cuenta de sucursal ve solo Cobrar, Caja, Finanzas, Tareas, Turnos y Clientes (sin Mi Negocio ni Configuración).
2. Finanzas para Cuenta de sucursal muestra solo Gastos y Sueldos.
3. Turnos y Finanzas no piden PIN al entrar; el PIN solo se evalúa por acción/vista sensible vía `requirePinForAction`.
4. `DailySummary.tsx` usa `useEffect` para `checkClosedBarbers`, sin `anulacionesHistoryOpen` ni `handleAnulacionesHistoryClick`, y sin imports muertos.
5. Auditoría intacta: `anulaciones_cierre` y `AnulacionesCierreHistory` siguen funcionando igual.

## Riesgo

Bajo. Cambio acotado a limpieza técnica en un único archivo, sin tocar lógica de PIN, Caja, Finanzas ni auditoría.
