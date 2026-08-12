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

## Fuera de alcance
Conversions API / server-side, UI de autoservicio del ID, niveles de consentimiento, eventos de conversión más allá de `PageView`.
