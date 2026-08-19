# Sistema legal de Vittro — plan técnico

Documentos globales de Vittro (no editables por las barberías), versionados, con aceptación individual trazable y páginas públicas.

## 1. Estado actual relevante

- No existe ningún contenido legal: sin rutas, páginas ni tablas. El footer de Homepage (`Homepage.tsx:725-738`) solo tiene logo y copyright.
- Rutas públicas actuales en `App.tsx`: `/`, `/login`, `/reset-password`, `/verify-email`, `/auth/callback`, `/:orgSlug/reservar`, `/app/:orgSlug`, `*`.
- Cookies: `useConsent.ts` guarda `vittro_cookie_consent` en localStorage (90 días, evento propio `vittro:consent-change`); `CookieConsentBanner.tsx` es una barra inferior con Aceptar/Rechazar y **sin link a política**.
- Configuración: `ConfigMenu.tsx` arma items con un tipo local `ConfigSection` y filtra por rol/plan. Agregar una sección es agregar un item + un case en el panel contenedor.
- Auth: `AuthContext` hidrata sesión → perfil + roles; `ProtectedRoute` encadena auth → org → suscripción, con pantallas recuperables y gate de `mustChangePassword` (patrón exacto a replicar para el gate legal).
- Registro: `Login.tsx` con `?mode=signup`; `signUp()` manda metadata al trigger de creación de organización.

## 2. Archivos/rutas afectados

Nuevos: `src/pages/legal/LegalDocPage.tsx`, `src/components/legal/LegalDocViewer.tsx`, `src/components/legal/LegalAcceptanceGate.tsx`, `src/hooks/useLegalDocs.ts`, `src/hooks/useLegalAcceptance.ts`, `src/components/config/PrivacidadTerminosSection.tsx`.

Tocados: `App.tsx` (3 rutas), `ProtectedRoute.tsx` (1 gate), `Login.tsx` (checkbox + links), `CookieConsentBanner.tsx` (link), `Homepage.tsx` (footer), `ConfigMenu.tsx` + panel contenedor, `ConfirmacionStep.tsx` (leyenda), `Reservar.tsx` (footer legal).

## 3. Modelo de datos recomendado

Dos tablas, sin CMS:

- `legal_documents`: `slug` (`terminos`|`privacidad`|`cookies`, único), `title`, `sort_order`, `activo`. Catálogo estable.
- `legal_document_versions`: `document_id`, `version` (texto, ej. `2026-08-01`), `content_md`, `summary` (qué cambió), `status` (`draft`|`published`|`archived`), `published_at`, `requires_acceptance` (bool: cookies puede publicarse sin forzar re-aceptación), `effective_from`. Único parcial: una sola versión `published` por documento.
- `legal_acceptances`: `user_id`, `document_version_id`, `accepted_at`, `ip inet`, `user_agent`, `context` (`signup`|`gate`|`reaccept`), `organization_id` (denormalizado para trazabilidad). Único `(user_id, document_version_id)`. **Append-only**: sin UPDATE ni DELETE para nadie.

Sin columnas nuevas en `profiles` — el estado se deriva por consulta, así no hay booleanos que se desincronicen.

## 4. Versionado

Borrador → revisión → publicación → histórico:
- Se inserta como `draft` y se edita libremente mientras esté en draft.
- Publicar = función SQL `publish_legal_version(version_id)` que archiva la publicada anterior y marca la nueva. Trigger que bloquea UPDATE de `content_md`/`version` cuando `status = 'published'|'archived'`.
- Nunca se borra: el histórico queda porque las aceptaciones apuntan a `document_version_id`.
- Administración interna: **sin UI en la app**. Se opera vía SQL editor de Supabase con `service_role`. Ninguna política concede escritura a usuarios. Si más adelante hace falta UI, se agrega una app aparte, no dentro de Vittro.

## 5. Registro de aceptación

Mínimo recomendado: usuario, versión exacta de cada documento, timestamp servidor (`now()`, no cliente), IP y user-agent. La IP no es visible en el navegador → se registra vía edge function `record-legal-acceptance` que lee `x-forwarded-for` y `user-agent`, valida el JWT del llamador y hace el insert con `service_role`. Ese es el único camino de escritura.

## 6. Usuarios nuevos

Checkbox obligatorio en el formulario de registro de `Login.tsx` ("Acepto los Términos y Condiciones y la Política de Privacidad", con links que abren `/terminos` y `/privacidad` en pestaña nueva). Se guardan los ids de versión vigentes al momento de mostrar el form; tras `signUp()` exitoso y con sesión activa, se llama a la edge function con `context='signup'`. Si esa llamada falla, no se rompe el registro: el gate del punto 7 lo va a pedir en el primer ingreso.

## 7. Usuarios existentes y ubicación del gate

Gate en `ProtectedRoute.tsx`, **después** de `mustChangePassword` y **antes** del chequeo de organización/suscripción — mismo patrón que ya funciona, sin redirects ni `Navigate`: se renderiza `<LegalAcceptanceGate/>` en lugar de `children`. Al aceptar, se setea estado local (igual que `passwordChanged`) y sigue el flujo sin recargar.

Pantalla: título "Actualizamos nuestros términos", lista de los documentos pendientes con link a la página pública (pestaña nueva, no navegación interna), y "Aceptar y continuar". Si la consulta de estado falla → `RecoverableErrorScreen` con reintento, nunca bloqueo mudo ni logout.

## 8. Nuevas versiones

El estado pendiente se calcula **una sola vez por sesión**: `useLegalAcceptance` consulta al hidratar y cachea el resultado en memoria por `user.id`. Si se publica una versión con el usuario adentro, no se revalida hasta el próximo login (no hay realtime, no hay polling, no hay refetch on focus). Solo `requires_acceptance = true` fuerza el gate.

RPC `get_pending_legal_acceptances()` (SECURITY DEFINER, una sola consulta) devuelve las versiones publicadas que exigen aceptación y que el usuario no aceptó. Una llamada, sin cascada.

## 9. `sucursal_account`

No acepta nada. El gate se salta cuando `isSucursalAccount` es true (o cuando el rol es solo `otros`). Su cobertura legal deriva de la aceptación del owner de la organización, y los Términos deben decir explícitamente que las cuentas compartidas de sucursal operan bajo la aceptación y responsabilidad del titular de la organización.

## 10. Configuración

Nuevo item en `ConfigMenu.tsx`: "Privacidad y términos" (ícono `FileText`), visible para **todos** los roles operativos, sin gate de plan. Al entrar: lista de documentos publicados (leída de la tabla, no hardcodeada) → detalle con contenido renderizado, versión y fecha de vigencia. Solo lectura, sin botones de edición. Escalable a documentos futuros porque la lista sale de la DB.

## 11. Portal público de reservas

Leyenda breve en `ConfirmacionStep.tsx`, sobre el botón de confirmar: "Al reservar, aceptás nuestros Términos y Condiciones y reconocés nuestra Política de Privacidad", con links a `/terminos` y `/privacidad`. Sin checkbox, sin bloqueo. Corresponde además aclarar en la leyenda o en el footer del portal que los datos se tratan por cuenta de la barbería, que es la responsable del tratamiento, y que Vittro actúa como proveedor del servicio.

## 12. CookieConsentBanner

Cambio mínimo: agregar "Más información" enlazando a `/cookies` en el texto del banner. Ajustes a evaluar después (no en este alcance): registrar la decisión también para usuarios logueados, permitir revocar el consentimiento desde Configuración, y versionar la política de cookies contra el consentimiento guardado.

## 13. Rutas públicas

`/terminos`, `/privacidad`, `/cookies` → un mismo componente `LegalDocPage` parametrizado por slug, cargando la versión publicada. Accesibles sin sesión. Se enlazan desde: footer de Homepage, formulario de registro y login, footer del portal de reservas, banner de cookies, y la sección de Configuración.

## 14. Riesgos de seguridad / RLS

- `legal_documents` y `legal_document_versions`: `SELECT` para `anon` y `authenticated` **solo** de filas `status = 'published'`. Los drafts no se exponen. Sin INSERT/UPDATE/DELETE para nadie salvo `service_role`.
- `legal_acceptances`: `SELECT` propio (`user_id = auth.uid()`); sin INSERT/UPDATE/DELETE para usuarios. Escritura exclusiva por la edge function. Esto evita que alguien falsifique una aceptación o borre la propia.
- Multi-tenant: las tablas legales son globales, sin `organization_id` obligatorio salvo el campo informativo en aceptaciones — es la excepción justificada al criterio general del proyecto.
- IP: dato personal. Se guarda con finalidad de prueba de consentimiento y debe declararse en la propia Política de Privacidad.

## 15-16. Riesgos sobre Auth y cómo evitar regresiones

El flujo post-login ya fue zona de bugs. Reglas duras del build:

- **Nada de rutas nuevas ni `Navigate`** para el gate: render condicional dentro de `ProtectedRoute`, como `ChangePasswordForm`. Sin redirects no hay loops.
- **Nada dentro de `AuthContext`**: no se toca la hidratación de sesión ni se agrega una query a la cadena crítica.
- **Una sola consulta, no bloqueante de la sesión**: si tarda o falla, se muestra error recuperable; nunca `signOut` automático.
- **Sin refetch on focus/interval/realtime** sobre el estado legal.
- **Fail-open acotado**: si la RPC devuelve error de red, se deja pasar y se reintenta en el próximo login, en vez de trabar a toda la base de usuarios por un incidente.
- No se toca `OrganizationContext` ni `SucursalContext`.

## 17. Información a relevar antes de redactar

- Inventario cerrado de datos personales por tabla (`clientes`, `profiles`, `barberos`, `turnos`, `access_logs`, `push_tokens`) con finalidad y plazo de retención de cada uno.
- Subprocesadores reales y su ubicación: Supabase (región del proyecto), Meta Pixel, MercadoPago, FCM/push, proveedor de email transaccional.
- Política de retención y borrado efectiva: qué es soft delete, qué se borra de verdad, en cuánto tiempo.
- Cómo se atiende un pedido de baja/acceso de un cliente final (hoy el canal es la barbería, no Vittro).
- Datos de la entidad legal de Vittro: razón social, domicilio, CUIT, email de contacto de privacidad.
- Confirmar que no se almacenan datos sensibles regulados (DNI, salud).
- Términos comerciales vigentes: precios, ciclo de facturación, política de reembolso, SLA si existe.

## 18. Fases

**Fase 1 — Base de datos.** Tablas, RLS, función de publicación, RPC de pendientes. Migración: sí. Riesgo: bajo (nada la consume aún). Dependencias: ninguna. Prueba: insertar draft, publicar, verificar que `anon` no ve drafts y que la RPC devuelve pendientes. No tocar: ninguna tabla existente.

**Fase 2 — Contenido y páginas públicas.** Redacción de los tres documentos (revisión profesional antes de publicar), carga como versiones, `LegalDocPage` + 3 rutas + link en footer de Homepage y en el banner de cookies. Migración: solo inserts de contenido. Riesgo: bajo. Dependencias: Fase 1. Prueba: abrir las 3 rutas deslogueado. No tocar: `ProtectedRoute`, `AuthContext`.

**Fase 3 — Configuración (solo lectura).** Item en `ConfigMenu` + sección. Migración: no. Riesgo: bajo. Dependencias: Fase 2. No tocar: permisos existentes.

**Fase 4 — Portal público.** Leyenda en `ConfirmacionStep`. Migración: no. Riesgo: muy bajo. No tocar: la lógica de reserva.

**Fase 5 — Edge function + registro en signup.** `record-legal-acceptance` y checkbox en el registro. Migración: no. Riesgo: medio (toca el alta). Prueba: registrar un usuario de prueba y verificar la fila de aceptación con IP y user-agent. No tocar: `ProtectedRoute` todavía.

**Fase 6 — Gate para usuarios existentes.** `LegalAcceptanceGate` + hook + un bloque en `ProtectedRoute`. Migración: no. Riesgo: **el más alto de todo el plan**. Dependencias: 1, 2 y 5. Prueba: owner sin aceptar, owner ya aceptado, `sucursal_account` (debe saltear), rol `otros`, y RPC forzada a fallar (debe dejar pasar, no loopear). No tocar: `AuthContext`, contextos de org/sucursal, orden de los gates previos.

Fases 1-5 son reversibles sin impacto en usuarios. Fase 6 va sola, en un build propio, con las otras ya validadas en producción.
