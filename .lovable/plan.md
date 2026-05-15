
## Objetivo

Eliminar la verificación por email en el portal público de reserva. El cliente no crea cuenta: completa sus datos, se hace match por teléfono dentro de la organización contra la tabla `clientes`, y se reutiliza o se crea el registro. Para "Mis turnos" se reemplaza el login por un lookup por teléfono.

No se toca el flujo de auth de dueños/barberos ni nada por fuera del portal de reserva.

---

## 1. Flujo nuevo de reserva (sin auth)

Pasos del stepper actuales: Sucursal → Servicio → Barbero → Fecha y horario → **Datos** → Confirmar.

El paso "Datos" reemplaza completamente a `AuthStep`. Form único con:

- Nombre *
- Apellido *
- Teléfono * (con selector de país, igual que hoy)
- Email (opcional)
- Fecha de nacimiento (opcional)

Validaciones cliente: nombre/apellido no vacíos (máx. 80), teléfono ≥ 6 dígitos, email con formato válido si se completa, fecha válida si se completa. Sin contraseña, sin instagram (ya removido).

Los datos quedan en estado local del stepper (`BookingState` extendido con `cliente: { nombre, apellido, telefono, phone_country, email, birthDate }`) y se pasan a `ConfirmacionStep`.

## 2. ConfirmacionStep

Deja de leer de `supabase.auth.getSession()`. Recibe `cliente` por props y lo manda directo al edge `validate-turno`. Sin `user_id`, sin metadata.

## 3. Edge function `validate-turno`

Cambios:

- Quitar toda la lógica de `Authorization` / `getUser` / `verifiedUserId` / `verifiedEmail`. Ya no hay sesión.
- Ya no recibe `user_id`. El insert de `turnos` guarda `user_id: null`.
- Match de cliente: **prioridad teléfono** (normalizado, igual a hoy) dentro de `organization_id` y `eliminado=false`. Si no hay match por teléfono y vino email, fallback opcional por email. Si no, se crea.
- Si existe: **pisar siempre** `nombre`, `apellido`, `telefono`, `email`, `fecha_nacimiento` con lo último ingresado (update directo, sin `fillIfEmpty`). No tocar `instagram`, `tiktok`, `nota_interna`, `acepta_marketing`, ni flags.
- Si no existe: insertar con `origen: 'portal_publico'`.
- Mantener `clientes_sucursales` upsert como hoy.
- Mantener snapshot en `turnos` (`cliente_nombre`, `cliente_telefono`, `cliente_email`, `cliente_id`).
- Sigue siendo público, sin verificación.

`config.toml`: `validate-turno` debe seguir con `verify_jwt = false` (ya lo está implícitamente, confirmar).

## 4. "Mis turnos" — lookup por teléfono

Reemplazar el `AuthStep` del modo `manage` por un `LookupTelefonoStep`:

- Input país + teléfono.
- Botón "Buscar mis turnos".
- Llama a un nuevo edge `get-my-turnos-by-phone` con `{ organization_id, phone_country, phone_local }`.

Nuevo edge `get-my-turnos-by-phone` (`verify_jwt = false`):

- Normaliza teléfono igual que `validate-turno`.
- Busca `turnos` de la org con `cliente_telefono = phone` y `estado in ('pendiente','confirmado')`, futuros (misma lógica de fecha/hora que el edge actual).
- Devuelve la misma estructura enriquecida que `get-my-turnos` (sucursal, barbero, servicio, `puede_cancelar`, `puede_reprogramar`).
- Sin auth. Solo expone datos básicos del turno propio del teléfono buscado.

`MisTurnosStep` se adapta para recibir la lista ya cargada o un callback de búsqueda; mantiene UI actual de listado, cancelar y reprogramar.

## 5. Cancelar / reprogramar sin auth

`cancel-turno` y `reschedule-turno` hoy validan ownership por JWT. Cambio:

- Aceptar `phone` (normalizado) en el body como prueba de ownership en lugar de JWT.
- Validan que `turno.cliente_telefono === phone_normalizado` y `turno.organization_id` coincida.
- Mantener resto de validaciones (estado, límite de horas, etc.).
- `verify_jwt = false`.

Frontend: `MisTurnosStep` y `RescheduleFlow` pasan el teléfono usado en el lookup a esos invokes.

## 6. Limpieza

- Eliminar uso de `AuthStep` en `BookingStepper` (book y manage).
- Eliminar el edge `register-customer` (ya no se usa). Quitar su entrada de `config.toml`.
- `get-my-turnos` actual: dejarlo si todavía hay usuarios con cuenta legacy, o eliminarlo. Propuesta: **eliminarlo** junto con `register-customer` para no mantener código muerto.
- `BookingStepper`: quitar `isAuthenticated`, `useEffect` de `supabase.auth.getSession`, lógica de `totalSteps` variable. Siempre 6 pasos en book.

---

## Detalles técnicos

### Archivos a modificar

- `src/components/reservar/BookingStepper.tsx` — quitar auth, agregar `cliente` en `BookingState`, render del nuevo step en posición 4.
- `src/components/reservar/ConfirmacionStep.tsx` — recibir `cliente` por props, sin `supabase.auth`.
- `src/components/reservar/MisTurnosStep.tsx` — recibir teléfono o aceptar carga inicial vía lookup.
- `src/components/reservar/RescheduleFlow.tsx` — pasar `phone` a `reschedule-turno`.
- `src/components/reservar/CancelTurnoDialog.tsx` — pasar `phone` a `cancel-turno`.

### Archivos a crear

- `src/components/reservar/DatosClienteStep.tsx` — form de 5 campos, valida y devuelve `cliente`.
- `src/components/reservar/LookupTelefonoStep.tsx` — form para "Mis turnos".
- `supabase/functions/get-my-turnos-by-phone/index.ts`.

### Archivos a eliminar

- `src/components/reservar/AuthStep.tsx`.
- `supabase/functions/register-customer/index.ts` y su entrada en `config.toml`.
- `supabase/functions/get-my-turnos/index.ts` (reemplazado).

### Edge functions a editar

- `validate-turno/index.ts` — sin auth, cliente vía body, pisar datos en match.
- `cancel-turno/index.ts` — ownership por teléfono.
- `reschedule-turno/index.ts` — ownership por teléfono.

### Base de datos

No se requiere migración. La tabla `clientes` ya tiene `telefono`, `email`, `fecha_nacimiento`. Los `turnos` ya guardan snapshot y permiten `user_id` null. RLS no se modifica (los edges usan service role).

### Riesgos y notas

- **Privacidad**: cualquiera con un teléfono podría listar los turnos asociados a ese número en una organización. El usuario aceptó esta solución como temporal hasta verificación por SMS.
- **Duplicados**: el match por teléfono normalizado dentro de la org evita duplicar clientes ante reservas repetidas.
- **Pisar datos**: si dos personas comparten teléfono dentro de la misma barbería, los datos se sobreescriben. Riesgo asumido.
- Turnos legacy con `user_id` y sin `cliente_telefono` quedan inaccesibles desde "Mis turnos" nuevo. Aceptable porque el portal público recién se está consolidando.
