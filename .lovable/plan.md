

## Plan: Verificación real de email + persistencia del plan en `organizations`

### Parte 1 — Frontend: verificación de email

#### 1.1 Pantalla `/verify-email` (`src/pages/VerifyEmail.tsx`) — nueva

Diseño consistente con `Login.tsx` (panel izquierdo branding + panel derecho contenido).

**Validación inicial al montar**: si `supabase.auth.getUser()` devuelve `email_confirmed_at`, redirigir inmediatamente a `/auth/callback`.

**Contenido**:
- Ícono `MailCheck` con fade-in.
- Título: "Revisá tu email para verificar tu cuenta"
- Subtexto dinámico: "Enviamos un email a `usuario@email.com`. Confirmalo para acceder a tu barbería."
- Aviso: "Puede tardar unos segundos en llegar."

**Acciones primarias**:
- **"Ya verifiqué mi cuenta"** — loading + disabled + reintento automático hasta 3 veces (cada 2.5s) usando `refreshSession()` + `getUser()`. Si confirma, navega a `/auth/callback`. Si no, toast: "Todavía no detectamos la verificación. Probá nuevamente en unos segundos."
- **"Reenviar email"** — loading + disabled durante envío, cooldown 60s tras éxito. Feedback: éxito "Email reenviado correctamente" / error "No pudimos reenviar el email. Intentá nuevamente".

**Sección "¿No recibiste el email?"**:
- Botón reenviar (mismo handler).
- Texto: "Revisá tu carpeta de spam o promociones."
- Accesos rápidos: "Abrir Gmail" / "Abrir Outlook" (nueva pestaña).
- Link "¿Email equivocado? Cambialo" → limpia `localStorage` y vuelve a `/login?mode=signup`.

**Resolución del email a mostrar** (orden, sin depender de navigation state):
1. `supabase.auth.getUser()` (sesión sin confirmar).
2. `localStorage.getItem('pending_verification_email')`.
3. Query param `?email=...`.

Suscripción a `onAuthStateChange`: si llega `SIGNED_IN`/`USER_UPDATED` con `email_confirmed_at`, navega a `/auth/callback`.

#### 1.2 Pantalla `/auth/callback` (`src/pages/AuthCallback.tsx`) — nueva

**UI mientras procesa**: spinner centrado + "Verificando tu cuenta...".

**UI "tarda más de lo esperado"**: a los 4s, debajo del spinner aparece "Esto está tardando más de lo esperado..." (reduce ansiedad).

**UI de error genérica**: mensaje + botón "Ir al login".

**UI de enlace inválido/expirado**: "El enlace de verificación es inválido o expiró" + botón "Solicitar nuevo email" (→ `/verify-email`) + link "Volver al login".

**Lógica idempotente con timeout de 8s**:
```text
status = 'loading' | 'error' | 'expired'
slowMessageVisible = false

mount:
  setTimeout(4s)  → slowMessageVisible = true
  setTimeout(8s)  → if status==='loading': status='error'

  // Idempotencia: aceptar tanto sesión recién creada como ya activa
  // Robustez ante caché stale: validar vía onAuthStateChange + segunda lectura

  let session = (await supabase.auth.getSession()).data.session

  if !session:
    // Esperar evento SIGNED_IN hasta 3s (Supabase puede estar procesando hash/code)
    session = await waitForSession(3000)  // suscribe a onAuthStateChange

  if !session:
    status = 'expired'; return

  // Re-validar para evitar datos cacheados de getSession()
  await supabase.auth.refreshSession()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user

  if !user?.email_confirmed_at:
    navigate('/verify-email', replace); return

  const userId = user.id   // fuente principal del ID

  // Resolver organization (multi-tenant, dinámico, NUNCA hardcodeado)
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single()

  if !profile?.organization_id:
    console.error('AuthCallback: profile/org missing for user', userId)
    await supabase.auth.signOut()
    toast.error("No encontramos tu organización. Iniciá sesión nuevamente.")
    navigate('/login', replace); return

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', profile.organization_id)
    .single()

  if !org?.slug:
    console.error('AuthCallback: organization slug missing', profile.organization_id)
    await supabase.auth.signOut()
    navigate('/login', replace); return

  clearTimeouts()
  localStorage.removeItem('pending_verification_email')   // limpieza siempre al éxito
  navigate(`/app/${org.slug}`, replace)
```

Helper `waitForSession(ms)`: suscribe a `onAuthStateChange`, resuelve en cuanto llega un evento con sesión válida, o `null` al expirar el timeout. Esto cubre el doble-click / segunda pestaña (sesión ya activa) y el caché stale de `getSession()`.

#### 1.3 Cambios en `Login.tsx` (handleRegister)

- `localStorage.setItem('pending_verification_email', registerEmail)`.
- Si `data.session === null`: `navigate('/verify-email')`.
- Si viene sesión: `navigate('/auth/callback')`.
- Eliminar el toast "Revisá tu email".

#### 1.4 Cambios en `AuthContext.tsx` (`signUp`)

- Aceptar parámetro `plan`.
- Pasar en `options.data.business_plan`.
- `emailRedirectTo: \`${window.location.origin}/auth/callback\``.

Además, en el listener de `onAuthStateChange` ya existente: si llega `SIGNED_IN` con `email_confirmed_at`, limpiar `localStorage.pending_verification_email` (segunda red de seguridad si el usuario nunca pasó por `/auth/callback`).

#### 1.5 Bloqueo de acceso en `ProtectedRoute.tsx`

Después de `if (!user)`:
```tsx
if (!user.email_confirmed_at) {
  return <Navigate to="/verify-email" replace />;
}
```

#### 1.6 Registrar rutas públicas en `App.tsx`

Antes del catch-all:
```tsx
<Route path="/verify-email" element={<VerifyEmail />} />
<Route path="/auth/callback" element={<AuthCallback />} />
```

### Parte 2 — Persistir el plan en `organizations`

Hechos verificados en DB:
- `organizations.plan` es `text` con default `'free'`.
- Valores válidos según `plan_features`: **`free`**, **`basic`**, **`premium`**.
- Form actual usa `basico`/`profesional`/`premium` → no matchean.
- `handle_new_user` hoy ignora cualquier plan del metadata.

#### 2.1 Alinear IDs del form con la DB (`Login.tsx`)

```text
{ id: 'free',    label: 'Básico',      price: '$30.000'  }
{ id: 'basic',   label: 'Profesional', price: '$50.000'  }
{ id: 'premium', label: 'Premium',     price: '$100.000' }
```
Default: `'free'`. Badge "Gratis primer mes" se mantiene.

#### 2.2 Pasar el plan al backend

`handleRegister` → `signUp(..., plan)` → `raw_user_meta_data.business_plan`.

#### 2.3 Migración SQL — `handle_new_user`

```sql
DECLARE user_plan TEXT;
...
user_plan := LOWER(COALESCE(NEW.raw_user_meta_data->>'business_plan', 'free'));
IF user_plan NOT IN ('free','basic','premium') THEN
  user_plan := 'free';
END IF;

INSERT INTO public.organizations (name, slug, plan, timezone)
VALUES (org_name, org_slug, user_plan, user_timezone)
RETURNING id INTO new_org_id;
```

Resto del trigger sin cambios. Retrocompatible.

### Parte 3 — Resumen de archivos

| Archivo | Cambio |
|---|---|
| `src/pages/VerifyEmail.tsx` | **Nuevo** — auto-redirect si ya verificado, email visible, "ya verifiqué" con loading + 3 reintentos, reenviar con loading + cooldown 60s + feedback, sección "¿No recibiste el email?", botones Gmail/Outlook |
| `src/pages/AuthCallback.tsx` | **Nuevo** — spinner + mensaje "tarda más de lo esperado" a los 4s + timeout 8s, idempotente (acepta sesión nueva o ya activa), `waitForSession()` vía `onAuthStateChange`, re-validación con `refreshSession()` para evitar caché stale, `session.user.id` como fuente, slug dinámico, signOut + redirect si falta profile/org, limpia `localStorage` al éxito |
| `src/App.tsx` | Registrar `/verify-email` y `/auth/callback` |
| `src/pages/Login.tsx` | IDs `free`/`basic`/`premium`, redirect a `/verify-email`, guardar email en localStorage, pasar `plan` |
| `src/contexts/AuthContext.tsx` | `signUp` recibe `plan`, `emailRedirectTo` apunta a `/auth/callback`, limpia `pending_verification_email` cuando el listener detecta usuario verificado |
| `src/components/ProtectedRoute.tsx` | Bloquear si `!user.email_confirmed_at` |
| Migración SQL | `handle_new_user` lee y normaliza `business_plan` con `LOWER()` |

### Reglas de robustez aplicadas

- **Idempotencia**: el callback funciona igual si el usuario hace doble click, abre el link en otra pestaña, o ya tenía sesión activa.
- **Sin caché stale**: `getSession()` se complementa con `waitForSession()` (vía `onAuthStateChange`) y `refreshSession()` antes de leer `email_confirmed_at`.
- **`session.user.id` como fuente principal** del ID en el callback.
- **Limpieza garantizada de `localStorage.pending_verification_email`**: en el callback al éxito, en `AuthContext` cuando el listener detecta verificación, y en "Cambiar email".
- **Sin estado previo crítico**: ambas pantallas reconstruyen toda la info desde la sesión + localStorage.
- **Sin slugs hardcodeados**: siempre se resuelve `profiles → organizations`.
- **Manejo explícito de enlaces expirados** con UI dedicada y acción para solicitar nuevo email.
- **Sin pantallas en blanco**: spinner, mensaje "tarda más de lo esperado" a los 4s, timeout duro a los 8s.
- **Auto-redirect** de usuarios ya verificados que llegan a `/verify-email`.
- **Migración SQL aditiva**: no afecta usuarios existentes.

