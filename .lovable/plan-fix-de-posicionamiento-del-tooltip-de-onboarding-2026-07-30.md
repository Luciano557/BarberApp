# Fix de posicionamiento del tooltip de onboarding

Objetivo: que el tooltip nunca quede cortado fuera del viewport y que, pase lo que pase, el usuario siempre tenga una salida visible del tour.

Alcance: exclusivamente el sistema de onboarding guiado (`src/components/onboarding/`). No se tocan pasos, textos ni otros módulos.

## 1. Medir la altura real del tooltip

Hoy el cálculo compara el espacio disponible contra una constante fija de 220px, mientras que un paso con 3 bullets mide ~320px. Se reemplaza por una medición real:

- Un `ref` sobre el card y un `ResizeObserver` que guarda su alto y ancho reales en estado.
- El primer render usa una estimación conservadora; en cuanto se mide, se reposiciona.
- La decisión de lado (abajo / arriba / derecha / izquierda) pasa a compararse contra la altura medida más el margen, no contra 220.

## 2. Clamp vertical y horizontal

- Después de elegir el lado, se acota `top` para que el card entre completo entre 12px del borde superior y 12px del inferior.
- Se mantiene el clamp horizontal actual y se extiende a las ramas laterales.
- Si ni arriba ni abajo ni los costados alcanzan, el tooltip cae al modo Dialog centrado que ya existe para `targetMissing`, con el spotlight del target todavía visible.

## 3. Tope de altura con scroll interno

El card recibe un `max-height` de `viewport - 24px` y el bloque de contenido (descripción + bullets) pasa a `overflow-y: auto`. El footer con "Continuar" y "Omitir tutorial" queda fijo abajo dentro del card, así nunca se corta aunque el contenido sea largo.

## 4. Scroll del target que contemple el tooltip

El `scrollIntoView` del provider usa `block: 'center'`, que en una tarjeta alta (el Collapsible abierto de "Cuentas de sucursal") empuja su borde inferior por debajo del centro y deja poco aire para el tooltip. Se sustituye por un scroll calculado que posiciona el target dejando lugar para el card medido, y se reejecuta si el target cambia de tamaño (por ejemplo al terminar la animación del Collapsible).

## 5. Salida garantizada siempre

- `Escape` omite el tour desde cualquier paso, no solo desde los diálogos.
- El bloqueo de scroll deja de aplicar cuando el target o el tooltip no entran completos en el viewport: en ese caso se permite scroll manual en lugar de dejar al usuario sin recurso.
- Un botón de cierre discreto en la esquina del card, visible en todos los pasos, que omite el tour.
- Estas tres salidas cubren el caso táctil en tablet horizontal (>768px de ancho), donde hoy no hay rueda, teclado ni scrollbar arrastrable.

## Archivos afectados

- `src/components/onboarding/OnboardingTooltip.tsx` — medición, flip, clamp, max-height con scroll interno, botón de cierre.
- `src/components/onboarding/OnboardingProvider.tsx` — scroll consciente del tooltip, Escape para omitir, bloqueo de scroll condicional.

## Verificación

Prueba en preview del paso `s4_cuenta_sucursal` en tres configuraciones: escritorio normal, ventana de ~800x600, y zoom al 150%. En las tres el card debe verse completo con el botón "Continuar" accesible, y `Escape` debe cerrar el tour.
