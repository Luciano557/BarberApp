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

Pendiente de implementación y validación.

## Publicación

Pendiente de ambos builds. El antecedente publicado queda en
`PORTAL_CLIENTE_PUBLICACION.md`.
