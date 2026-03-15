

# Agregar flujo "Olvidé mi contraseña"

Actualmente la app no tiene funcionalidad de recuperación de contraseña. Hay que agregar:

## Cambios

### 1. Login.tsx — Link "¿Olvidaste tu contraseña?"
Agregar un link debajo del botón "Ingresar" que muestre un formulario inline (o dialog) para ingresar el email y enviar el link de recuperación usando `supabase.auth.resetPasswordForEmail()`.

### 2. Nueva página `/reset-password`
Página donde el usuario aterriza después de clickear el link del email. Detecta el token `type=recovery` en la URL, y muestra un formulario para ingresar la nueva contraseña. Usa `supabase.auth.updateUser({ password })`.

### 3. Registrar ruta en App.tsx
Agregar `<Route path="/reset-password" element={<ResetPassword />} />` como ruta pública.

## Flujo
1. Usuario clickea "¿Olvidaste tu contraseña?" en Login
2. Ingresa su email → se llama `resetPasswordForEmail` con `redirectTo` apuntando a `/reset-password`
3. Recibe email con link → clickea → llega a `/reset-password`
4. Ingresa nueva contraseña → se actualiza → redirige al login con toast de éxito

## Acción inmediata para tu cuenta
Mientras tanto, puedo resetear tu contraseña manualmente desde el dashboard de Supabase si necesitás acceso urgente.

