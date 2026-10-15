# Aliados — niveles por referidos y comunicación de ingresos

Solicitud del usuario del 2026-10-14: presentar la comisión como subida de niveles,
usar un elemento gráfico de barbería, quitar seguidores de Instagram, dirigirse
tanto a quien recomienda a sus amigos como a un creador con comunidad, ocultar
condiciones en un desplegable y mejorar el correo nativo mostrado en la captura.

## Etapa lógica validada localmente

- Nivel 1: 10% desde el alta; nivel 2: 20% con cinco barberías calificadas;
  nivel 3: 30% con veinte. Sigue siendo una organización con dos mensualidades
  distintas aprobadas/sin reversión, contada una vez. Convenios vigentes prevalecen.
- Instagram deja de influir tanto en TypeScript como en SQL, aunque lleguen métricas
  históricas. La conexión queda retirada incluso si se cambian switches de entorno.
  Se mantiene desconexión para limpieza de una conexión antigua. No se programan
  refresh jobs nuevos y los trabajos antiguos se retiran sin llamadas a Meta.
- Términos v2 para nuevas adhesiones/atribuciones/cotizaciones. La aceptación de
  miembros existentes y snapshots financieros ya fijados siguen intactos; no se
  fabrican aceptaciones ni se reescriben comisiones o convenios históricos.
- API conserva un campo Instagram vacío para clientes anteriores en caché; no
  revela métricas ni permite el nivel por audiencia. Tablas antiguas siguen privadas.

Inspección previa de producción: un aliado, cero cuentas/credenciales/jobs de
Instagram. Cambio SQL dirigido: `20261014230000_partner_referral_levels.sql`, solo
funciones INVOKER, sin alterar handle_new_user, tablas ni RLS. Es una modificación
solicitada del mismo programa cuyo despliegue directo autorizó el usuario; se
conserva el orden de publicación original/fork establecido por AGENTS.md.

Pruebas locales: 34 de dominio, 27 PostgreSQL/PGlite y chequeo Deno de API/worker.
Se sustituyó la prueba de OAuth por retiro de conexión/métricas/refresh y se
preservaron las pruebas de descuentos, cobros, reversiones, lotes y aislamiento.

## Etapa visual y correo

Dirección: “Generá ingresos con tu código de referidos”; una sola voz para amigos
y comunidad, registro externo sin requerir ser creador. Frasco de loción como
medidor geométrico de nivel, con porcentajes y requisitos escritos. No sustituye
los números por color. El panel usa progreso real; la landing presenta niveles
ilustrativos seleccionables. Condiciones cerradas por defecto y accesibles por
teclado; un enlace a #condiciones las abre.

El correo mostrado usa la plantilla nativa Magic Link de Supabase, compartida
con cualquier acceso por enlace del proyecto. Se rediseña esa plantilla en español
con marca Vittro y CTA de ingreso genérica, conservando ConfirmationURL. No se
envían emails de prueba a terceros ni se cambia SMTP, remitente o otras plantillas.

Build visual cerrado y validado localmente: landing, panel, registro y CTA de
Homepage usan “código de referidos”. El frasco tiene tres estados seleccionables
en landing y avance real entre umbrales en panel; un convenio se comunica aparte
del nivel automático. Details nativo conserva teclado/foco y abre por #condiciones.

QA acotado, primera ronda sin defectos: 11 escenarios (landing/panel/Admin a
390/768/1440 y correo a 390/680), sin overflow ni errores; interacción de niveles
y desplegable por teclado, enlace directo y cifras de hasta diez dígitos. Siete
pruebas nuevas de UI cubren progreso, convenio y disclosure. Build/lint focal
aprobados. Capturas y reporte: `.impeccable/review/partners/`.

El HTML versionado está en `supabase/templates/magic-link.html`, con tablas e
inline styles para clientes de correo, logo público, fallback de fuente y enlace
de respaldo. Tiene dos ConfirmationURL nativas y ningún enlace de autenticación
fabricado. El preview usa preview.invalid. Auditoría Auth real: subject “Your Magic
Link”, body de 105 caracteres, sin template URL externo; coincide con la captura.
PATCH previsto solo sobre subject/content de Magic Link, conservando los demás
campos de Auth. [Referencia oficial](https://supabase.com/docs/guides/auth/auth-email-templates).

Pendiente de integración: aplicación dirigida de SQL/Auth template, deploy de
funciones/frontend y verificación productiva. No se envían emails a terceros.
