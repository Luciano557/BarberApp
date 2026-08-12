# Píxel de Meta + banner de consentimiento

Instalar tracking de Meta en dos superficies públicas: la Homepage (píxel fijo de Vittro) y el portal de reserva por organización (píxel configurable por barbería), ambos condicionados a un banner simple de consentimiento.

## Qué se construye

### 1. Base de datos
- Migración: agregar `meta_pixel_id text NULL` a `portal_config`.
- Validación con trigger (no CHECK): si viene valor, debe ser solo dígitos, 10 a 20 caracteres; string vacío se normaliza a NULL.
- Carga manual por ahora: se edita directo en la base. Sin UI de autoservicio.
- Sin cambios de RLS: la tabla ya está protegida y el campo se lee vía edge function con service role.

### 2. Edge function `get-org-public`
- Agregar `meta_pixel_id` al `select` de `portal_config`.
- Devolverlo dentro del objeto `portal` ya existente, validado en el server (regex numérica); si no pasa, `null`.
- Cuando no hay fila de `portal_config`, el fallback devuelve `meta_pixel_id: null`.

### 3. Píxel fijo de Vittro (Homepage)
- ID vía variable de entorno `VITE_META_PIXEL_ID` (no editable desde UI).
- Se dispara únicamente en la ruta `/` (Homepage), nunca en la app interna ni en el portal.

### 4. Píxel por organización (Reservar)
- Se dispara solo en `/:orgSlug/reservar`, solo si esa organización tiene ID cargado.
- Aislamiento: se inicializa un único pixel ID por página; si el visitante navega a otra organización, el hook desmonta y vuelve a inicializar con el nuevo ID (React key por `orgSlug`), para que nunca convivan dos.

### 5. Banner de consentimiento
- Dos opciones: "Aceptar" y "Rechazar". Sin niveles intermedios.
- Se guarda en `localStorage` (`vittro:cookie-consent`) con `{ value, decided_at }`. Expira a los 3 meses; pasado ese plazo vuelve a mostrarse.
- Aparece solo en superficies públicas (Homepage y Reservar), no en la app interna.
- Texto: "Usamos cookies para mejorar tu experiencia y medir el rendimiento de campañas publicitarias." + botones.
- Estilo sobrio con tokens semánticos (`bg-card`, `border`, `muted-foreground`, botón `primary`). Al vivir dentro del contenedor con `getPortalThemeStyle`, hereda el color de marca de la organización sin lógica extra.
- Mobile: barra fija inferior con `safe-area-inset-bottom`, botones táctiles; desktop: mismo patrón, ancho contenido.

## Timing (punto clave)

El banner **no espera** a nada: se evalúa contra `localStorage` en el primer render, así que puede aparecer mientras el skeleton de Reservar todavía carga.

El píxel de organización espera **dos condiciones a la vez**:

```text
consentimiento = "aceptado"   AND   portal.meta_pixel_id != null
                        |
                        v
              cargar fbq + init + PageView
```

Es decir, el efecto que carga el script depende de ambos valores; se dispara en el momento en que el último de los dos se cumple, sin importar el orden. Casos:
- Acepta antes de que resuelva el edge function: el píxel arranca al llegar los datos.
- Los datos llegan primero y acepta después: arranca al tocar "Aceptar".
- Rechaza: nunca se inyecta el script ni se crea la cookie `_fbp`.

En Homepage el ID está disponible de entrada, así que solo depende del consentimiento.

## Archivos

Nuevos:
- `src/lib/analytics/metaPixel.ts` — inyección idempotente del snippet `fbq`, `init(id)`, `track('PageView')`, y limpieza al desmontar.
- `src/hooks/useConsent.ts` — lectura/escritura de la decisión en `localStorage`, expiración a 3 meses, estado reactivo compartido.
- `src/hooks/useMetaPixel.ts` — hook que combina consentimiento + ID y hace la carga condicional.
- `src/components/consent/CookieConsentBanner.tsx` — el banner.

Modificados:
- `supabase/functions/get-org-public/index.ts` — select + salida del nuevo campo.
- `src/pages/Reservar.tsx` — tipar `meta_pixel_id` en `PortalDataView`/`OrgPublicData`, montar el banner y el hook dentro del contenedor con theming.
- `src/pages/Homepage.tsx` — montar el banner y el hook con el ID de env.
- `.env` — `VITE_META_PIXEL_ID`.
- Migración SQL para la columna nueva.

## Riesgos y fricciones

- **CSP**: hoy el proyecto no define Content-Security-Policy, así que no bloquea nada. Si más adelante se agrega, hay que permitir `connect.facebook.net` y `www.facebook.com`.
- **Rendimiento**: el script se carga async y solo después del consentimiento, por lo que no afecta el primer render ni el LCP del portal.
- **Doble `PageView`**: `fbq` es global; el módulo debe ser idempotente para no contar dos veces por re-render o StrictMode en desarrollo.
- **Cross-org**: riesgo real si se navega entre portales sin desmontar; se cubre re-inicializando por `orgSlug`.
- **Adblockers**: una parte de las visitas no va a registrar. Es esperable y no se compensa en esta etapa (Conversions API queda fuera de alcance).
- **Legal**: el banner cubre lo básico; no incluye página de política de cookies. Si se quiere, se suma un link a texto legal más adelante.

## Eventos de conversión

Auditoría previa a esta sección:
- El registro de una barbería **no está en Homepage**. Está en `src/pages/Login.tsx` (`handleRegister`, ruta `/login?mode=signup`); la Homepage solo linkea ahí. El punto de éxito ocurre en el **cliente**: después de `signUp(...)` de `AuthContext` (que llama a `supabase.auth.signUp`) sin error, justo antes de navegar a `/verify-email` o `/auth/callback`. No hay edge function involucrada.
- La confirmación de turno está en `src/components/reservar/ConfirmacionStep.tsx` (`handleConfirm`), tras `supabase.functions.invoke("validate-turno")` sin `fnError` ni `data.error`, en el mismo punto donde hoy se muestra el toast de éxito y se llama `onConfirmed()`. Ese componente ya recibe `orgData` como prop, así que tendría el `meta_pixel_id` disponible sin props nuevas; el consentimiento lo lee del hook global `useConsent`.

### Ajuste de alcance: el píxel fijo también carga en `/login`
Como el registro vive en `/login`, el píxel de Vittro debe montarse en Homepage **y** en Login (misma superficie pública, mismo ID de env). Sin eso el evento se dispararía sin píxel inicializado. El banner de consentimiento se muestra en ambas rutas.

### Eventos

| Evento | Píxel | Archivo y punto exacto |
|---|---|---|
| `PageView` | ambos | automático al inicializar (ya contemplado) |
| `CompleteRegistration` | fijo de Vittro | `src/pages/Login.tsx` › `handleRegister`, tras `signUp` sin error, antes del `navigate` |
| `Schedule` | de la organización | `src/components/reservar/ConfirmacionStep.tsx` › `handleConfirm`, tras respuesta OK de `validate-turno`, junto al toast de éxito |

### Util adicional en `metaPixel.ts`
Se agrega `trackMetaEvent(name, params?)`: dispara `fbq('track', name, params)` **solo si** el píxel ya fue inicializado en esta página. Si no lo fue (sin consentimiento o sin ID cargado), es un no-op silencioso. No encola eventos: un evento sin consentimiento simplemente se pierde, que es el comportamiento correcto.

### Timing: sin cambios
La condición sigue siendo `consentimiento aceptado` **y** `pixel id disponible`. Los dos eventos ocurren siempre después de esas condiciones:
- `CompleteRegistration` es una acción del usuario en `/login`, muy posterior al montaje del hook; si rechazó cookies, es no-op.
- `Schedule` es el último paso del stepper, muy posterior al resolve de `get-org-public`; si la organización no tiene `meta_pixel_id` o el visitante rechazó, es no-op.

No hace falta espera ni cola adicional.

## Fuera de alcance
Conversions API / server-side, UI de autoservicio del ID, niveles de consentimiento, y cualquier evento más allá de `PageView`, `CompleteRegistration` y `Schedule`.
