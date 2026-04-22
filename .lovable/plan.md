

## Plan: Confirmar email manualmente — `sebastian.tello20001@gmail.com`

### Diagnóstico

La cuenta existe en `auth.users` pero tiene `email_confirmed_at = NULL`, por lo que Supabase Auth bloquea el inicio de sesión hasta que se confirme el email.

| Campo | Valor |
|---|---|
| user_id | `d3111779-a809-4fe4-b250-3649d73cd44b` |
| email | sebastian.tello20001@gmail.com |
| created_at | 2026-04-22 13:34 UTC |
| email_confirmed_at | **NULL** ← bloquea login |
| last_sign_in_at | nunca |
| business_name (signup) | perri barbershop |
| full_name | Sebastian Tello |

Como el flujo de registro propio (`handle_new_user`) ya creó la organización "perri barbershop", la sucursal "Casa Central", el `profile`, el rol `owner` y el `user_sucursales` correspondientes — solo falta marcar el email como confirmado.

### Acción única

Una migración puntual sobre `auth.users` para setear `email_confirmed_at = now()` exclusivamente en este `user_id`:

```sql
UPDATE auth.users
SET email_confirmed_at = now(),
    confirmed_at       = COALESCE(confirmed_at, now())
WHERE id = 'd3111779-a809-4fe4-b250-3649d73cd44b'
  AND email = 'sebastian.tello20001@gmail.com'
  AND email_confirmed_at IS NULL;
```

- Filtro doble por `id` + `email` para evitar cualquier riesgo de afectar otra fila.
- Idempotente: si ya estuviera confirmado, no hace nada.
- No toca `profiles`, `organizations`, `sucursales`, `user_roles` ni `user_sucursales` — todo eso ya está creado por el trigger de signup.
- No cambia password. El usuario inicia con la contraseña que eligió al registrarse.

### Lo que NO se hace

- No se reenvía email de confirmación (la idea es justamente saltearlo).
- No se modifica ninguna tabla de aplicación.
- No se altera el flujo de auth ni `handle_new_user`.
- No se toca ningún otro usuario.

### Verificación post-cambio

1. Re-consultar `auth.users` filtrando por ese email → `email_confirmed_at` debe estar seteado.
2. Pedirle al usuario que ingrese desde `/login` con su email y la contraseña que usó al registrarse.
3. Confirmar que entra a `/app/perri-barbershop-<hash>` como `owner` de su organización.

### Nota operativa

Si en el futuro hay que repetir esto seguido para otros usuarios, conviene desactivar "Confirm email" en Supabase Auth → Providers → Email, o bien implementar un panel admin. Para este caso puntual, la migración directa es lo más rápido y seguro.

