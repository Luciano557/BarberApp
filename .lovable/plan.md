## Problema

No podemos desactivar "Confirm email" globalmente en Supabase porque dueños y barberos sí necesitan verificar su email al registrarse. Pero los clientes que reservan turnos deben poder crear cuenta sin verificar (la verificación por teléfono llegará más adelante).

## Solución

Crear los clientes desde una edge function con privilegios de servicio que los marque como ya confirmados (`email_confirm: true`). El frontend, después de llamar a la function, hace `signInWithPassword` con las credenciales recién creadas y continúa el flujo de reserva normalmente.

Esto deja intacto el flujo de owners/barberos (que siguen pasando por `supabase.auth.signUp` y reciben el email de confirmación).

## Cambios

### 1. Nueva edge function `register-customer` (pública, `verify_jwt = false`)

`supabase/functions/register-customer/index.ts`:
- Recibe: `email`, `password`, `nombre`, `apellido`, `phone`, `phone_country`, `birth_date`.
- Valida campos (zod o validación manual: email válido, password ≥ 6, nombre/apellido no vacíos, teléfono ≥ 6 dígitos).
- Usa `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { account_type: "customer", nombre, apellido, full_name, phone, phone_country, birth_date } })`.
- Si el email ya existe → devuelve `409 { error: "email_exists" }` para que el frontend muestre "Ese email ya está registrado, iniciá sesión".
- Devuelve `{ ok: true }` en éxito (no devuelve tokens; el cliente hace sign-in después).
- CORS habilitado, no requiere JWT del caller.

Registrar la función en `supabase/config.toml` con `verify_jwt = false`.

### 2. `src/components/reservar/AuthStep.tsx`

En la rama de registro:
- Reemplazar `supabase.auth.signUp(...)` por `supabase.functions.invoke("register-customer", { body: { ... } })`.
- Si la function devuelve `email_exists`, mostrar toast "Este email ya tiene cuenta. Iniciá sesión." y cambiar a modo login con el email precargado.
- Si devuelve ok, llamar a `supabase.auth.signInWithPassword({ email, password })` y luego `onAuthenticated()`.
- Quitar el `signUp` directo y el comentario `// TODO: re-enable email verification` (ya no aplica acá).

No se tocan: el flujo de login existente, el registro de owners/barberos, ni la configuración global "Confirm email" de Supabase.

## Detalles técnicos

- `auth.admin.createUser` con `email_confirm: true` crea el usuario ya confirmado, sin enviar email de verificación. Solo accesible desde el server con `SUPABASE_SERVICE_ROLE_KEY` (ya disponible en edge functions).
- El `account_type: "customer"` en `user_metadata` permite seguir distinguiendo clientes de owners/barberos en triggers o lógica posterior si hace falta.
- No hace falta migración de DB.
- El email del cliente queda disponible para futura verificación opcional, y cuando se implemente verificación por teléfono se puede agregar como paso adicional sin romper este flujo.

## Acción manual requerida

Ninguna. "Confirm email" sigue activo en Supabase para owners/barberos.
