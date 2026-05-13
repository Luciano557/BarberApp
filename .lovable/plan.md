
# Fix avatar cortado y drag posterior al zoom

## Problema 1 — Avatar cortado

Causa: en `BookingLanding`, el contenedor del header tiene ahora `overflow-hidden`, pero el avatar está anclado a `bottom-0` con `translate-y-1/2`, es decir, sobresale hacia abajo del header por la mitad de su alto. Con `overflow-hidden` esa mitad inferior queda recortada, dando la sensación de “a medias”.

Fix:
- En `BookingLanding`, separar capas:
  - Wrapper exterior `relative` (sin `overflow-hidden`) que contiene la portada, el degradado y el avatar.
  - Capa interna `absolute inset-0 overflow-hidden` que envuelve solo la `<img>` de portada para clipear el zoom/pan.
  - El avatar queda como hijo directo del wrapper exterior, manteniendo `translate-y-1/2` y `z-20`, así no lo afecta el clip.
- Restaurar el aspecto previo del avatar: `bg-card`, `ring-4 ring-card`, `shadow-md` (sombra leve que diferencia sin recargar). Quitar `border border-border/50` y `shadow-xl` para volver a la composición original solicitada.
- Misma corrección en el marco del editor (`PortalCoverPositionDialog`) para que la preview interna refleje exactamente el mismo avatar (sombra leve, no recargada). El marco sí debe seguir clipeando la imagen.

## Problema 2 — No se puede mover después del zoom

Causa: hoy se panea cambiando `object-position` y se aplica `transform: scale(z)` con `transform-origin` igual a `object-position`. Con `object-cover`, `object-position` solo puede mover dentro del overflow generado por el desajuste de aspect-ratio entre imagen y contenedor; el zoom CSS añadido por `transform` no genera nuevo margen para `object-position`. Resultado: con zoom > 1 el slider/drag de X/Y prácticamente no mueve la imagen.

Fix (consistente en editor, landing y preview): reemplazar el modelo `object-position + transform-origin` por un transform unificado que sí permita panear con cualquier zoom.

Modelo propuesto:
- `<img>` con `object-fit: cover` (object-position queda en `center`, default).
- `transform: translate((50 - x)%, (50 - y)%) scale(zoom)` con `transform-origin: center`.
- Semántica conservada: x=50, y=50 → centrado; x<50 → muestra más del lado izquierdo de la imagen; x>50 → muestra más del lado derecho. Mismos valores 0–100 ya guardados en DB.
- Funciona con cualquier zoom porque el translate es absoluto en el espacio del elemento (= contenedor), no depende del overflow de `object-position`.

Aplicar el mismo bloque de `transform` exacto en:
- `BookingLanding` (header de portada)
- `PortalCoverUploader` (thumbnail)
- Marco interno del `PortalCoverPositionDialog`
- Capa contextual de fondo del `PortalCoverPositionDialog`

### Drag en el editor

Con el nuevo modelo, el cálculo de drag se simplifica y deja de depender del overflow de aspecto:

```
dxPct = -(dx / frameW) * 100 / zoom
dyPct = -(dy / frameH) * 100 / zoom
x = clamp(startX + dxPct, 0, 100)
y = clamp(startY + dyPct, 0, 100)
```

(misma fórmula que ya estaba; ahora sí funciona porque el translate panea más allá del overflow nativo de `object-cover`).

Pinch ↔ drag: mantener la lógica actual de Pointer Events. Al levantar uno de dos dedos, reanudar drag desde el dedo restante (ya implementado). Verificar que después del pinch:
- `pinchRef` se limpia cuando `pointersRef.size < 2`.
- Si queda 1 dedo, `dragRef` se reinicia con `{ startX: x, startY: y, px: remaining.x, py: remaining.y, zoom }` (ya está, queda igual).

## Out of scope

Reservas, disponibilidad, validación, cancelación, reprogramación, rutas públicas, edge functions de agenda, permisos, RLS, esquema de DB. No se cambian props persistidas (`cover_position_x/y`, `cover_zoom`).

## Validación

1. Portal y preview: avatar visible entero, centrado sobre el borde inferior de la portada, con sombra leve que lo diferencia sin tapar nada.
2. Editor: hacer zoom (slider, rueda o pinch) y luego arrastrar mueve la imagen en ambos ejes, en mobile y desktop.
3. Sliders X/Y mueven la imagen también con zoom > 1.
4. El encuadre guardado se ve idéntico en editor, preview y portal público.
