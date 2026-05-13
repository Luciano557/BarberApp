# Estabilizar el flujo de login de Vittro

Foco: corregir la **causa real** por la que la app queda en "Verificando sesión..." o "Cargando datos...". El timeout es solo una red de seguridad UX, **no** la solución.

## Diagnóstico de la causa real


| #   | Problema                                                                                                                            | Archivo                                        | Síntoma observable                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `onAuthStateChange` y `getSession()` corren ambos y pueden pisar `isLoading`/`profile`/`roles`                                      | `src/contexts/AuthContext.tsx`                 | "Verificando sesión..." intermitente tras login                               |
| 2   | `Promise.all([fetchProfile, fetchRoles])` sin `try/catch/finally` dentro del listener                                               | `AuthContext.tsx`                              | Si una query falla por red, `setIsLoading(false)` nunca corre                 |
| 3   | `from('organizations').select('*').single()` sin filtro explícito ni `maybeSingle`; sin `error` en el contexto                      | `OrganizationContext.tsx`                      | Org no carga → `isLoading` queda en true → ProtectedRoute se queda en spinner |
| 4   | `Login.handleLogin` duplica fetch de `getUser` + profile + organization en paralelo a `AuthContext`, sin try/catch ni timeout local | `pages/Login.tsx`                              | Botón "Ingresando..." atascado si una de esas queries cuelga                  |
| 5   | `ProtectedRoute` solo conoce loading; no maneja error recuperable                                                                   | `ProtectedRoute.tsx`                           | Spinner eterno cuando algo falla "en silencio"                                |
| 6   | `useSupabaseData.fetchData` sí tiene `finally`, pero no expone `error` ni `refetch` para reintento UX                               | `hooks/useSupabaseData.ts` + `pages/Index.tsx` | "Cargando datos..." sin salida si falla la fetch inicial                      |


## Cambios

### A. `src/contexts/AuthContext.tsx` — hidratación única e idempotente

- Crear función `hydrateSession(session)` reutilizada por **ambos** caminos:
  - Sin sesión → limpia `user`, `session`, `profile`, `roles` de forma sincrónica.
  - Con sesión → setea `user`/`session`, luego `Promise.all([fetchProfile, fetchRoles])`.
  - Toda la carga envuelta en `try/catch/finally`. `finally` siempre hace `setIsLoading(false)`.
  - `catch`: `console.error('[Auth] hydrate:error', err)`; mantiene `user`/`session`, limpia `profile`/`roles`. No re-lanza.
- Usar `hydratingFor` ref (`user.id` o `null`) para evitar carreras: si llega un evento con la misma `session.user.id` que ya está en curso, ignorar.
- `getSession()` corre primero al montar; el listener `onAuthStateChange` delega siempre en `hydrateSession` (manteniendo el `setTimeout(0)` actual para no bloquear el callback de Supabase).
- Logs: `[Auth] phase=getSession:start|done`, `[Auth] phase=onAuthStateChange event=<event>`, `[Auth] phase=hydrate:start|success|error`. Sin tokens, sin emails completos.

### B. `src/contexts/OrganizationContext.tsx` — fetch determinístico

- Reescribir `fetchOrganization(userId)`:
  1. Si no hay user → limpiar `organization`, `planFeatures`, `error=null`, `setIsLoading(false)`.
  2. `select('organization_id').from('profiles').eq('id', userId).maybeSingle()`.
  3. Si no hay `organization_id` → `setError('Tu cuenta no tiene una organización asignada.')` y cerrar loading.
  4. `from('organizations').select('*').eq('id', orgId).maybeSingle()` → si null → `setError('No pudimos cargar tu organización.')`.
  5. Si OK → `setOrganization` + cargar `plan_features` (errores en plan_features no rompen, solo log).
- `try/catch/finally` con `setIsLoading(false)` siempre y `console.error('[Org] phase=fetch:error', err)`.
- Exponer al contexto: `error: string | null`, `refreshOrganization()` (limpia error y reintenta).

### C. src/pages/Login.tsx — sin lógica duplicada y con cierre garantizado

- handleLogin envuelto en try/catch/finally; finally hace setIsLoading(false) en todos los caminos.

- Tras signIn exitoso, resolver la navegación con un helper aislado y controlado.

- El helper puede usar el user devuelto por signInWithPassword si está disponible, o leer la sesión actual de forma segura.

- Evitar duplicar innecesariamente la lógica de AuthContext.

- Si se necesita obtener organization.slug para navegar a /app/:orgSlug, hacerlo mediante resolveOrgSlug(userId).

- resolveOrgSlug debe:

  - consultar profiles.organization_id con maybeSingle();

  - consultar organizations.slug con eq('id', organization_id).maybeSingle();

  - tener timeout local de 6 s vía Promise.race;

  - usar try/catch/finally;

  - no interferir con el estado global de AuthContext.

- Si hay timeout/error resolviendo orgSlug:

  - mostrar toast informativo;

  - navegar a "/" o a una pantalla segura;

  - dejar que AuthContext/ProtectedRoute terminen de resolver;

  - nunca dejar el botón en "Ingresando...".

- No tocar el resto del componente: UI, modos, registro.

### D. `src/components/ProtectedRoute.tsx` — error recuperable, no spinner eterno

- Mantener spinner solo mientras `authLoading || orgLoading`.
- Cuando termina la carga:
  - Si no hay `user` → `<Navigate to="/login" />` (igual que hoy).
  - Si hay `user` y `orgError` → render de pantalla recuperable (mismo estilo del fallback actual): título "No pudimos cargar tu cuenta", mensaje del error, botones **Reintentar** (`refreshOrganization()`) y **Cerrar sesión** (`signOut()` + redirect a `/login`).
- No rediseñar nada más.

### E. `src/hooks/useSupabaseData.ts` + `src/pages/Index.tsx` — error recuperable en datos

- En `useSupabaseData`:
  - Agregar estado `error: string | null`.
  - En el `catch` de `fetchData`: `setError(msg)` además del toast actual; `console.error('[Data] phase=fetch:error', err)`.
  - En el `try` al inicio: `setError(null)`; al éxito: `console.info('[Data] phase=fetch:success')`.
  - Exponer `error` y `refetch: fetchData`.
- En `Index.tsx`:
  - Si `!isLoading && error` → renderizar pantalla recuperable con **Reintentar** (`refetch()`) y **Cerrar sesión**. Sin tocar permisos, tabs ni queries.

### F. Fallback progresivo de timeout (red de seguridad UX, no solución)

- Crear hook reutilizable `useProgressiveLoading(active: boolean)` con tres umbrales: `delayed=8s`, `showRetry=25s`, `fatal=90s`.
- Usarlo en los dos loaders existentes: `ProtectedRoute` ("Verificando sesión...") y `Index` ("Cargando datos...").
  - 8 s → texto auxiliar `"Esto está tardando más de lo normal..."` debajo del loader.
  - 25 s → botón **Reintentar** que llama al retry contextual:
    - En `ProtectedRoute`: `refreshOrganization()` si hay user; si no, no aparece.
    - En `Index`: `refetch()`.
  - 90 s → render full-screen recuperable: "No pudimos terminar de cargar tu sesión. Puede deberse a una conexión lenta o a un problema temporal." + **Reintentar** + **Cerrar sesión**.
- Reglas estrictas: **no** logout automático, **no** navegación automática, **no** `window.location.reload`, **no** ocultar errores reales (un error → pantalla recuperable inmediata, no espera al timeout).

## Pruebas

1. Login normal (owner, general_manager, manager, barber, sucursal_account).
2. Logout + login.
3. Refresh con sesión guardada.
4. Conexión lenta simulada (DevTools throttling) → ver mensajes a 8 s y botón a 25 s.
5. Usuario sin roles / sin organization → pantalla recuperable, no spinner.
6. Bloquear request a `organizations` (DevTools) → pantalla recuperable con Reintentar.
7. Bloquear `servicios` → "Cargando datos..." termina en pantalla recuperable.
8. Múltiples eventos rápidos de `onAuthStateChange` (login → refresh token) → estados consistentes.

## Devolutiva al finalizar (lo que voy a reportar)

1. Cuál loading quedaba activo y dónde.
2. Archivo causante principal.
3. Cambios concretos en `AuthContext`, `OrganizationContext`, `Login.tsx`, `ProtectedRoute`, `Index`/`useSupabaseData`.
4. Cómo opera el fallback progresivo.
5. Cómo verificar el fix.

## Fuera de alcance

RLS, edge functions, modelo de roles, schema DB, rediseño visual del Login, PIN, permisos funcionales, lógica de negocio de Index, rutas públicas de reservas.