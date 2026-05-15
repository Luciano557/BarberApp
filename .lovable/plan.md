## 1. Finanzas → Deudas: "Confirmar Pago" cancela la deuda completa

**Cambio funcional:** hoy el botón registra una cuota (incrementa `cuotas_pagadas` y `monto_pagado`). El usuario quiere que el botón mueva la deuda directamente de **Activa → Pagada** (un solo click, sin cuotas parciales).

**Implementación en `src/hooks/useDeudas.ts`:**
- Reescribir `registrarPago` para hacer un único `UPDATE` que setee:
  - `monto_pagado = monto_total`
  - `cuotas_pagadas = cuotas_totales` (si existen)
  - `estado = 'pagada'`
- Toast: "Deuda marcada como pagada".

**`src/components/DeudasPanel.tsx`:**
- Envolver el botón "Confirmar Pago" en un `AlertDialog` de confirmación ("Vas a marcar esta deuda como pagada en su totalidad. ¿Confirmar?") para evitar clicks accidentales, ya que ahora es una acción definitiva.

No se cambia el modelo de datos. Las cuotas siguen registrándose en el alta como referencia, pero el flujo de pago ya no las usa.

## 2. Reservar turno → desactivar verificación de email

**Contexto:** la confirmación de email se habilita/deshabilita desde el dashboard de Supabase Auth (no desde `config.toml`). Para que el cambio sea efectivo el usuario debe desactivar **"Confirm email"** en Authentication → Providers → Email del proyecto Supabase.

**Cambios en `src/components/reservar/AuthStep.tsx`:**
- Tras un `signUp` exitoso, si no hay `data.session` (email aún no confirmado), intentar inmediatamente `signInWithPassword` con las credenciales recién creadas y, si funciona, continuar al flujo de reserva.
- Eliminar el branch que muestra "Revisá tu email para confirmar el acceso" y el `setIsLogin(true)` posterior.
- Si aun así no se logra sesión, mostrar un mensaje genérico ("No pudimos iniciar sesión, intentá de nuevo").

Se dejará un comentario `// TODO: re-enable email verification` para marcar que es temporal.

## 3. Reservar turno → quitar campo Instagram en el registro

**`src/components/reservar/AuthStep.tsx`:**
- Quitar el input de Instagram del formulario de registro.
- Quitar `instagram` del estado `form` y de `options.data` en `signUp`.
- No se toca el flujo de booking ni `validate-turno` (el campo `cliente_instagram` puede seguir aceptándose como opcional desde otros orígenes; simplemente ya no se enviará desde el registro).

## 4. Reservar turno → evitar duplicados de clientes

**Estado actual:** la edge function `validate-turno` ya hace deduplicación al crear/actualizar el registro en `clientes`:
1. Busca por `email` (case-insensitive) en la organización.
2. Si no encuentra, busca por `telefono` exacto.
3. Si encuentra, hace un *soft patch* (rellena solo campos vacíos) y vincula la sucursal.
4. Si no encuentra, inserta un nuevo `cliente`.

**Mejora a aplicar en `supabase/functions/validate-turno/index.ts`:**
- Normalizar el teléfono antes de comparar y antes de insertar: quitar espacios, guiones y paréntesis (mantener el `+` inicial si viene). Esto evita que `+54 11 5555 5555` y `+541155555555` se traten como distintos.
- Aplicar la misma normalización al guardar `telefono` en `clientes` y en `turnos.cliente_telefono` para que matches futuros sean consistentes.
- Trim + lowercase ya está para email; mantenerlo.
- Agregar un fallback adicional: si no hay match por email ni por teléfono pero el `auth.user_id` (verificado por token) ya tiene un `cliente` vinculado en otra reserva previa de la misma org (`turnos.user_id` → `cliente_id`), reutilizar ese `cliente_id` en lugar de crear uno nuevo.

No se requieren cambios de schema ni migraciones.

## Detalles técnicos

- **Archivos a editar:**
  - `src/hooks/useDeudas.ts` (reescribir `registrarPago`)
  - `src/components/DeudasPanel.tsx` (AlertDialog de confirmación de pago)
  - `src/components/reservar/AuthStep.tsx` (auto sign-in post signUp, quitar Instagram)
  - `supabase/functions/validate-turno/index.ts` (normalización de teléfono + fallback por user_id)
- **Acción manual del usuario:** desactivar "Confirm email" en el dashboard de Supabase Auth para que el registro sin verificación funcione.
- **Sin migraciones de DB.**
