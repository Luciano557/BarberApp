
## Resumen

Detecté 3 causas raíz concretas en el código actual:

1. `public.handle_new_user()` sigue creando organización + sucursal + rol `owner` para cualquier alta en `auth.users`, incluso usuarios invitados.
2. El flujo de PIN está partido en dos sistemas incompatibles:
   - validación real: `barberos.pin_hash` (`validate-pin`, `set-pin`)
   - UI de autoconfiguración: `user_pins` (`PinConfigSection`)
3. La visibilidad del panel depende de `AuthContext`, pero todavía hay pantallas con checks ad-hoc que no respetan del todo la matriz de cargos.

## Plan

### 1) Arreglar el bug de “todos nacen Dueño”
- Crear una migración para reemplazar `handle_new_user()`:
  - si `NEW.raw_user_meta_data->>'invited_by'` existe, solo crear `profiles`
  - no crear organización
  - no crear sucursal
  - no insertar `owner`
  - no insertar `user_sucursales`
- En la misma migración, reparar datos ya afectados:
  - quitar `owner` duplicado a invitados que además tengan otro cargo
  - corregir `profiles.default_sucursal_id`
  - normalizar `user_sucursales` según la sucursal real del usuario/barbero
- Actualizar `supabase/functions/invite-user/index.ts` para que:
  - asigne el cargo siempre, también si el usuario ya existía
  - no dependa de `!isExistingUser`
  - cree/ajuste la membresía correcta en `user_sucursales`
  - deje el perfil apuntando a la organización y sucursal correctas

### 2) Unificar el sistema de PIN y habilitar primer acceso real
- Tomar `barberos.pin_hash` como única fuente de verdad del PIN.
- Rehacer `PinConfigSection.tsx` para que deje de consultar `user_pins` y use el `barbero_id` del usuario logueado.
- Extender `usePinProtection.ts` para exponer:
  - si el usuario actual tiene barbero vinculado
  - si ese barbero ya tiene PIN
  - si necesita setup inicial
- En `PinProtectedSection.tsx`, cuando el usuario entra por primera vez a una sección protegida y no tiene PIN, mostrar formulario de creación de PIN inline en vez del formulario de validación.
- Replicar esa lógica en `PinGateDialog.tsx` para acciones protegidas que hoy abren modal de PIN.
- Endurecer `supabase/functions/set-pin/index.ts`:
  - autogestión solo sobre el propio `barbero_id`
  - owner/GM pueden seguir configurando PINs desde staff
  - mantener validación de PIN actual para cambio/eliminación

### 3) Hacer que cada cargo vea solo su panel permitido
- Consolidar la matriz de permisos en `AuthContext.tsx` con flags más explícitos por módulo/acción.
- Revisar `AppSidebar.tsx` e `Index.tsx` para que:
  - no calculen navegación final hasta que auth/roles estén cargados
  - siempre caigan a una pestaña válida si el cargo no puede abrir la actual
- Reemplazar checks directos por permisos centralizados en pantallas clave:
  - `TareasPanel.tsx`
  - `DailySummary.tsx`
  - `MultiDayClosingSummary.tsx`
- Objetivo final:
  - Dueño / Encargado General: acceso total
  - Encargado de Sucursal: solo módulos permitidos por la matriz vigente
  - Barbero: solo Caja + Tareas
  - Otros: sin acceso al panel

## Archivos a tocar

- `supabase/migrations/*` — fix del trigger + reparación de datos
- `supabase/functions/invite-user/index.ts`
- `supabase/functions/set-pin/index.ts`
- `src/hooks/usePinProtection.ts`
- `src/components/PinProtectedSection.tsx`
- `src/components/PinGateDialog.tsx`
- `src/components/PinConfigSection.tsx`
- `src/contexts/AuthContext.tsx`
- `src/components/AppSidebar.tsx`
- `src/pages/Index.tsx`
- `src/components/TareasPanel.tsx`
- `src/components/DailySummary.tsx`
- `src/components/MultiDayClosingSummary.tsx`

## Validación

- Invitar un barbero nuevo: queda solo con `barber`, nunca con `owner`.
- Invitar un usuario existente: recibe el cargo correcto.
- Primer login sin PIN: puede crear PIN al intentar entrar a una sección protegida.
- Verificación de menú y acceso real para: Dueño, Encargado General, Encargado de Sucursal, Barbero y Otros.
