# Aliados — cuatro niveles y pulverizador de progreso

Solicitud del usuario del 2026-11-05: ampliar el incentivo automático a cuatro
niveles y dar al medidor una forma reconocible del mundo de la barbería.

| Nivel | Barberías calificadas | Comisión del primer pago |
|---|---:|---:|
| 1 | 0 | 10% |
| 2 | 5 | 30% |
| 3 | 10 | 50% |
| 4 | 20 | 80% |

Cinco barberías en nivel 2 conserva el umbral anterior solicitado. La calificación
continúa requiriendo dos mensualidades distintas sin reversión por organización,
contada una vez. No cambian el descuento, base de cálculo, espera ni liquidación.
Los convenios aprobados siguen prevaleciendo hasta 100%; Instagram sigue retirado.

## Auditoría y etapa de lógica

Revisión de dominio TS, RPC/partner_rate, cotizaciones, snapshots y superficies.
Producción coincidió con el source de v2: hashes de prosrc RPC
4e8cff738a6737dad22f6cf80abd0305 y rate 212fa1fec0447bc2443e44ffe786418a,
ambas funciones INVOKER. Alta/billing activos y términos v2 antes del cambio.
Ninguna escritura durante la auditoría.

El pedido implementa una revisión del mismo programa autorizado para producción
directa en esta conversación. Se conserva la excepción acotada DB/RLS documentada
en el rollout original; no se altera handle_new_user, ningún DEFINER, tabla o RLS.
Migración dirigida `20261105180000_partner_four_levels.sql`, con guardas sobre
ambos hashes. Reemplaza únicamente la tasa automática y los literales de términos
para adhesiones/cotizaciones nuevas. Aceptaciones, convenios, cotizaciones y
snapshots anteriores permanecen intactos. No usar db push del historial completo.

Dominio comparte PARTNER_LEVELS entre API y presentación para evitar inferir el
número de nivel dividiendo el porcentaje. Nuevas condiciones: 2026-11-05-v3.

Etapa lógica validada localmente: 36 pruebas de dominio, 29 PostgreSQL/PGlite y
chequeo Deno de API/worker. SQL recorre 0/4/5/9/10/19/20 calificaciones, reversión,
rechazo de aceptación obsoleta y una migración v2→v3 sobre una cotización congelada
al 20%. Esta conserva su versión/tasa y genera la comisión histórica correcta;
un convenio al 25% también se conserva. No se conectan proveedores ni dinero real.

## Etapa visual e integración

Pulverizador SVG geométrico, con boquilla/gatillo y cuatro marcas. Llenado en
cuartos en la exploración ilustrativa de landing, e interpolación entre umbrales
reales en panel. El porcentaje no se usa como número de nivel. Todos los datos
siguen escritos y el SVG es redundante para lectores de pantalla; el explorador
anuncia la selección y conserva botones nativos/teclado. Movimiento reducido
desactiva la transición breve del líquido. Sin imágenes externas o dependencias.

Landing comunica 10–80%, presenta las cuatro entradas y conserva las condiciones
plegadas por defecto, ahora v3. Convenios y cifras de ingreso siguen separados
del progreso automático. Correo y recorrido de alta no cambian.

Revisión con Impeccable y React Best Practices. Pruebas dirigidas: 47 Vitest
(36 dominio, ocho UI de niveles/disclosure y tres de Auth), ocho Deno HTTP/HMAC,
build Vite y ESLint focal correctos. QA Playwright: 11 escenarios sintéticos
con tráfico remoto interceptado (landing/panel/Admin a 390/768/1440 y correo
a 390/680). Selección de los cuatro niveles por teclado, progreso hacia 50%,
disclosure cerrado/direct link, sin errores ni overflow. Inspección conjunta
desktop/mobile sin defectos; no hubo ronda de retoques. Evidencia local:
`.impeccable/review/partners/` y `supabase/tests/partners-ui-qa.cjs`.

Pendientes: publicación original/fork y aplicación puntual de migración/backend.
