# Portal cliente — contrato visual aprobado

Petición: rediseñar con más impacto visual, evitar aspecto genérico y sumar
animaciones agradables, usando recursos de Vittro y manteniendo performance.
Respuesta confirmada: **barbería protagonista; Vittro como firma**.
El usuario aprobó el plan y pidió implementación/publicación directa.

Build code-led, sin comp generada aprobada. La referencia de producto es el
portal real Scissors; su portada negra texturada y su logo son recursos reales
elegidos por esa barbería, no fotografías de stock ni placeholders.

## Dirección y primer viewport

Composición editorial con portada grande a la izquierda y nombre, descripción,
acciones de reserva/gestión y contacto a la derecha. En teléfono, portada
horizontal, logo superpuesto y una columna con acción primaria visible. Si no
hay portada/logo, iniciales reales sobre color de la barbería, sin inventar
fotos. Inter y los neutros fríos existentes, acento elegido por la barbería.
Vittro aparece en un wordmark vectorial pequeño como firma.

Dentro del flujo, identidad compacta, catálogo de filas abiertas, fecha/hora
como foco y resumen lateral tipo comprobante. En móvil, contexto compacto.
Confirmación con fecha/hora grandes en el comprobante y calendario/inicio.

## Interacción distintiva

Continuidad de avance/regreso de 220 ms, sin desmontar el borrador de datos.
La confirmación tiene un sello de check de 420 ms y dibujo de trazo de 360 ms.
No hay loops, nuevas librerías, filtros animados ni mediciones de altura.
Movimiento reducido conserva todo el contenido y suprime transformaciones.

## Quality bar

La identidad real debe dominar de inmediato. Sin landing SaaS, claims nuevos,
iconos decorativos repetidos ni tarjetas dentro de tarjetas. La reserva se
reconoce como tarea principal y los hechos del turno tienen mejor jerarquía.
Lectura/tap/foco claros y sin scroll horizontal, incluyendo 320 px, nombres
extensos, servicios sin espacios y precios de ocho dígitos.

## Evidencia local

Capturas del browser (bytes JPEG, extensión png por convención del workflow):
`desktop.png` y `user-1280.png`: portada 1280 px. `mobile.png`: portada 390 px.
`services-desktop.png`: catálogo 1280 px desde el inicio del documento.
`dates-mobile.png`, `data-mobile.png`, `confirm-mobile.png`,
`success-mobile.png`, `manage-mobile.png`: flujo con datos sintéticos 390 px.
`fallback-320.png`, `stress-services-320.png`: contenido de estrés/color amarillo.
Se inspeccionó también 1440 px inicialmente, pero la captura final de escritorio
es de 1280 px; ambas composiciones corresponden al mismo breakpoint.

Navegación completa sintética hasta confirmación y Mis turnos. Sin escrituras
remotas. En 320/390, scrollWidth = client viewport sin desborde. Sin errores de
consola en la recaptura final. Fechas 78 px, entradas de paso 0,22 s computados.
50 pruebas dirigidas correctas (38 flujo/calendario/red + 12 tema/contraste).
Login/Admin cargan sus rutas diferidas; entrada interna sin sesión deriva a login.

Detector ejecutado una vez: 16 advisory (15 tamaños, 1 radio), cero findings de
error/warning. Los tamaños editoriales y portada de 16 px son deliberados para
esta superficie; deben documentarse en DESIGN.md tras cerrar la revisión.
