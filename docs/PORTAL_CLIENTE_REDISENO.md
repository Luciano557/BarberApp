# Portal cliente — rediseño y carga inicial

## Alcance aprobado (2026-11-05)

Barbería protagonista; Vittro como firma. Portada y logo reales, composición
editorial responsive, catálogo de servicios, fecha/hora como foco y resumen con
forma de comprobante. Inter y tokens existentes. Movimiento de navegación y
selección de 180–220 ms, confirmación hasta 420 ms, alternativa con movimiento
reducido. Sin dependencias nuevas de animación ni imágenes decorativas pesadas.

El usuario aprobó dos builds separados y publicación directa, siguiendo
`FLUJO_PUBLICACION.md`: original, fork existente y verificación en Vercel.
Sin cambios de DB/RLS, Edge Functions ni contratos de las reservas.

## Build 1 — carga inicial (validado localmente)

`src/App.tsx` mantiene eager el portal y difiere nueve rutas de marketing,
autenticación, operación y administración mediante `React.lazy`. `Suspense`
envuelve únicamente `Routes`; la jerarquía de providers y permisos se conserva.
La espera usa el retraso de skeleton existente para evitar destellos.

Medición reproducible: `vite build --manifest` y
`node scripts/measure-entry-bundle.mjs`. Suma el entry y sus imports estáticos,
gzip nivel 9, excluye chunks dinámicos. No mide LCP ni latencia de usuarios.

| Estado | JS inicial | JS gzip |
|---|---:|---:|
| Base `aa71fb6` | 3.274.858 B | 913.397 B |
| Build 1 | 880.271 B | 256.390 B |

Reducción del JS comprimido de entrada: 71,9%. Los chunks de las demás rutas se
cargan al visitarlas. TypeScript, ESLint de los archivos cambiados y build
correctos. Evidencia: diff de `src/App.tsx` y manifest de Vite. La prueba visual
y el smoke de las rutas se completan con el build 2.

## Build 2 — visual y movimiento

Implementado sobre el build 1: portada editorial con recursos reales, identidad
compacta durante la reserva, catálogo abierto, comprobante y firma SVG Vittro.
`PortalPreview` conserva la composición de teléfono y heading h2. Los datos,
handlers y contratos del backend se mantienen. El borrador sigue montado.

Se eliminó el reflow/animación de altura del resumen. Motion CSS: avance/regreso
220 ms, check 360 ms y sello 420 ms; sin loops ni nuevas dependencias. Reduce
motion desactiva esos movimientos y mantiene el contenido visible. Contraste
sRGB lineal: texto blanco/negro sobre el acento y tinta/foco seguros para colores
claros. Skeleton inicial acompaña la nueva composición.

| Medición final | Valor |
|---|---:|
| JS inicial | 875.041 B |
| JS inicial gzip | 255.612 B |
| CSS inicial | 128.663 B |
| CSS inicial gzip | 22.490 B |

72,0% menos JS gzip que `aa71fb6`. CSS base: 118.478 B sin comprimir. La métrica
no incluye imágenes de cada barbería ni mide LCP; no se sustituyeron sus archivos.

Validación real: TypeScript y build correctos; ESLint de archivos cambiados sin
errores (un warning Fast Refresh preexistente de `buildDefaultPortalDescription`).
50 pruebas dirigidas correctas. Suite global: 356/364, mismos ocho fallos de
Auth/organización reproducidos en la base durante el trabajo anterior; no se
modificaron esos contextos para alterar el resultado.

Navegador con datos sintéticos: reserva completa, identificación, confirmación,
regreso y Mis turnos. Inspección de escritorio y móvil, además de textos/precios
extensos y marca amarilla a 320 px. Foco visible, sin overflow horizontal.
Login/Admin diferidos cargan y la entrada interna sin sesión deriva a Login.
Sin errores de consola en recapturas finales. No se realizaron reservas reales.

Revisión independiente: `.impeccable/review/portal-redesign/review.md`. Dos fixes
materiales aplicados: selector de trazo `path` + montaje de entrada de confirmación,
y breakpoints compartidos de Tailwind. DOM comprobado: entrada 0,22 s, trazo 0,36 s;
1023 px una columna / 1024 px dos, sin overflow. Detector una vez: cero errores o
warnings; 16 advisory de escala/radio deliberados, documentados en DESIGN.md.
Capturas locales ignoradas por Git; brief, reporte y evidencia DOM versionados.
Veredicto independiente posterior: `ship` limitado a los dos fixes evaluados,
ambos `resolved`; `.impeccable/review/portal-redesign/verdict.md`.

## Publicación

Pendiente de ambos builds. El antecedente publicado queda en
`PORTAL_CLIENTE_PUBLICACION.md`.
