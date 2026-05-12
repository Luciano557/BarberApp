# Fase 4 — Wiring de acciones sensibles con PIN (v2)

## Resumen de auditoría

Wiring correcto hoy: `cerrar_caja`, `anular_transaccion`, `anular_cierre_caja`, `regularizar_cierre_caja`, `ver_historial_caja`, `registrar_gasto`, `anular_gasto`, `registrar_pago_sueldo`, `crear_tarea`, `editar_tarea`, `completar_tarea`.

Sin uso real: `editar_gasto` (no hay flujo de edición). `PinProtectedSection.tsx` y `SucursalViewPinGate.tsx` quedan huérfanos pero no se tocan en esta fase.

Faltantes a cablear: `bloquear_cliente`, `ver_gastos` (solo bloque sensible), `ver_sueldos` (solo bloque sensible).

## Cambios

### 1. `src/components/clientes/ClienteDetailDialog.tsx` — `bloquear_cliente`

- Imports si faltan: `useRequirePinForAction` desde `@/components/ActionPinGate`, `useSucursal` desde `@/contexts/SucursalContext`.
- En el componente: `const requirePinForAction = useRequirePinForAction();` y `const { currentSucursal } = useSucursal();`.
- En `handleConfirmBlock`, antes de `blockCliente`:

```ts
const gate = await requirePinForAction('bloquear_cliente', currentSucursal?.id ?? null);
if (!gate.ok) return;
```

- No tocar `handleConfirmUnblock`.

### 2. `src/components/GastosPanel.tsx` — gate manual solo sobre la vista sensible

- **No** disparar PIN al montar.
- Form "Registrar gasto" siempre visible (cubierto por `registrar_gasto` al confirmar).
- Mantener intactos los gates de `registrar_gasto` y `anular_gasto`.
- Estado: `const [gastosViewUnlocked, setGastosViewUnlocked] = useState(false);`.
- `useAuth` desde `@/contexts/AuthContext`: `const { isSucursalAccount } = useAuth();`.
- Derivado: `const shouldGateGastosView = isSucursalAccount && !gastosViewUnlocked;`.
- Handler:

```ts
const handleUnlockGastosView = async () => {
  const gate = await requirePinForAction('ver_gastos', currentSucursal?.id ?? null);
  if (!gate.ok) return;
  setGastosViewUnlocked(true);
};
```

- En el `Card` "Historial":
  - Si `shouldGateGastosView`: reemplazar `CardContent` por placeholder discreto con copy breve ("El detalle de gastos puede requerir autorización.") y `<Button onClick={handleUnlockGastosView}>Ver gastos</Button>`. Header se conserva o se simplifica sin exponer datos. Ocultar también el paginador de mes mientras esté gateado.
  - Si no: render actual (tabla + total + paginador).
- No tocar `GastosRecurrentesList` ni form de gastos recurrentes.

### 3. `src/components/SueldosPanel.tsx` — gate manual solo sobre la vista sensible

- **No** disparar PIN al montar.
- Mantener intacto el gate de `registrar_pago_sueldo`.
- Estado: `const [sueldosViewUnlocked, setSueldosViewUnlocked] = useState(false);`.
- `useAuth` y `useSucursal` si no están.
- Derivado: `const shouldGateSueldosView = isSucursalAccount && !sueldosViewUnlocked;`.
- Handler:

```ts
const handleUnlockSueldosView = async () => {
  const gate = await requirePinForAction('ver_sueldos', currentSucursal?.id ?? null);
  if (!gate.ok) return;
  setSueldosViewUnlocked(true);
};
```

- Antes de editar, leer `SueldosPanel.tsx` para identificar bloques sensibles (resumen / detalle por barbero / liquidaciones / historial de pagos) vs. acciones operativas (registrar pago).
- Si `shouldGateSueldosView`: reemplazar bloques sensibles por placeholder con `<Button onClick={handleUnlockSueldosView}>Ver sueldos</Button>`. Conservar visible la acción de registrar pago si existe como entrada operativa independiente.

## Comportamiento esperado

Cuenta de sucursal:
- Finanzas no abre PIN al entrar.
- Gastos: form visible; historial detrás de `ver_gastos`.
- Sueldos: detalle detrás de `ver_sueldos`.
- Bloquear cliente pasa por `bloquear_cliente`.

Cuentas personales (owner / general_manager / manager / barber):
- No ven placeholder ni `PinGateDialog`. Render normal según permisos.

## Lo que NO se toca

`AuthContext`, `ActionPinGate`, `PinGateDialog`, `validate-pin`, `set-pin`, `user_pins`, RLS, edge functions, roles, métodos de pago, Mi Negocio, `sucursalActions.ts`, auditoría, DB, invitaciones, permisos generales, defaults de PIN, `PinProtectedSection.tsx`, `SucursalViewPinGate.tsx`. No se agregan actionKeys nuevos. No se agrega `regularizar_dia_caja`.

## Riesgos

Bajo. Tres archivos, sin disparos automáticos de PIN. El flag `isSucursalAccount` garantiza que cuentas personales nunca vean placeholder.
