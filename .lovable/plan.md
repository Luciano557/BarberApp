# Etapa 2 — Zoom iOS: campos restantes + URL pública

Un solo build. Cambios puramente de presentación.

## Parte A — 6 campos a 16px en mobile

Patrón igual que Etapa 1: `text-base md:text-<tamaño actual>`. Desktop queda idéntico.

### 1. ComisionEquipoConfig.tsx:413 (input % en fila de regla)
- Hoy: `w-16 h-7 text-xs text-right`.
- Propuesto: `w-16 h-9 md:h-7 text-base md:text-xs text-right`.
- Motivo del alto: 28px con texto de 16px deja ~6px de aire total; el número queda ahogado y el área táctil es menor al mínimo cómodo. En mobile sube a 36px; en desktop se preserva 28px.
- El ancho `w-16` (64px) sigue alcanzando: el valor máximo es "100" más el spinner numérico, y el texto está alineado a la derecha.

### 2. ComisionEquipoConfig.tsx:481 (input % del formulario de alta)
- Hoy: `w-16 h-8 text-xs text-right`.
- Propuesto: `w-16 h-9 md:h-8 text-base md:text-xs text-right`.
- Sube 4px solo en mobile; desktop intacto.
- El ícono `Percent` al lado (`h-3 w-3 shrink-0`) no cambia: el contenedor es `flex items-center`, se recentra solo.

### 3. ClienteSearchPicker.tsx:58 (buscador dentro del popover)
- Hoy: `h-10 ... text-sm`.
- Propuesto: `text-base md:text-sm`. El alto `h-10` (40px) ya es suficiente para 16px, no se toca.

### 4. phone-input.tsx:291 (input de teléfono)
- Hoy: `px-3 text-sm`.
- Propuesto: `text-base md:text-sm`.
- El contenedor tiene alto fijo `h-10` y el input es `flex-1` con `min-w-0`: no se toca el alto ni el layout.

### 5. phone-input.tsx (~224, botón selector de país)
- Hoy: `px-3 text-sm`.
- Propuesto: `text-base md:text-sm`, para que el prefijo (`+54`) quede parejo con el número en mobile.
- No dispara zoom (es `<button>`), el cambio es solo de coherencia visual.
- Riesgo menor: el bloque de bandera + dial + chevron gana unos px de ancho en mobile, reduciendo el espacio del input. Mitigado porque el input es `flex-1 min-w-0` y el contenedor tiene `overflow-hidden`. Si el prefijo quedara demasiado ancho en pantallas chicas, se compensa bajando el padding a `px-2.5 md:px-3` en ese botón.

## Parte B — URL pública sin input

`<Input readOnly>` (línea 253) pasa a un elemento no interactivo.

- **Elemento recomendado: `<div>`.** Es contenido de datos, no un párrafo de prosa; y como la URL puede ocupar dos líneas, un `div` evita márgenes tipográficos implícitos y permite alinear verticalmente con los botones sin sorpresas. `<span>` queda descartado por ser inline (no toma el alto ni el ancho del contenedor de forma predecible).
- **Estilo:** replicar el look del Input — `rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs` — más `min-h-10` para conservar el alto visual actual cuando la URL entra en una sola línea.
- **Selección manual:** sin `user-select-none`. Se añade `select-all` para que un tap/click seleccione la URL completa, y el botón "Copiar" sigue siendo el camino principal.
- **Wrap sin truncar:** `break-all whitespace-normal`. `break-all` es lo correcto para una URL sin espacios; `break-words` no rompería una cadena continua larga. Nada de `truncate` ni `overflow-x`.
- **Accesibilidad:** el `div` se marca con `title={publicUrl}` y sigue siendo texto plano seleccionable. No entra en el orden de tabulación, que es justamente el objetivo (iOS ya no le hace foco → no hay zoom).
- **Sin tocar:** `publicUrl` (74-77), `handleCopy` (100-104), ni los botones "Copiar" / "Ver portal".

### Balance del layout de la tarjeta
El contenedor es `flex flex-col sm:flex-row gap-2`:
- **Mobile:** la URL va arriba en su propio bloque y los botones abajo. Si la URL rompe a dos líneas, el bloque crece hacia abajo sin desplazar ni comprimir los botones. Para que no se vea desbalanceado se agrega `flex-1 min-w-0` al div.
- **Desktop:** en fila, el div toma el ancho restante con `flex-1 min-w-0` y los botones conservan su tamaño. Se agrega `items-start sm:items-center` para que, en el caso raro de dos líneas en desktop, los botones queden centrados respecto del bloque y no estirados.

## Riesgos no contemplados antes
- **Spinners numéricos:** los dos inputs `type="number"` de ComisionEquipoConfig muestran flechas nativas en desktop; al subir el alto solo en mobile, el look de desktop no cambia. Sin riesgo, pero conviene mirar la fila una vez aplicada porque `w-16` con 16px es el punto más ajustado del build.
- **Densidad de la fila de reglas:** subir a `h-9` en mobile aumenta el alto de cada fila unos 8px. Con muchas reglas la lista se alarga; es el costo esperado de eliminar el zoom.
- **Cambio de alto de la tarjeta del link:** con orgSlug largos la URL pasará a dos líneas en mobile, donde hoy se truncaba dentro del input. La tarjeta crece unos 18px. Es el comportamiento pedido.
- **Tests/selectores:** si algún test apunta al input de la URL por rol `textbox`, dejará de encontrarlo. Se verifica durante el build.

## Viabilidad de un solo build
Sí. Los cinco archivos son independientes entre sí y ninguno comparte componente base con los ya resueltos en Etapa 1. Parte A es cambio de clases; Parte B es reemplazo de un nodo aislado. No hay conflicto.

## Candado
No se tocan Login.tsx, ningún Select/SelectTrigger, input.tsx, textarea.tsx, select.tsx, ni las líneas 329/397 de PortalPublicoSection.tsx. Sin cambios de lógica de negocio ni de validaciones.
