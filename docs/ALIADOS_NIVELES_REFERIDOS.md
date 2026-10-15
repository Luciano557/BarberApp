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

Pendiente al cerrar la etapa lógica: build visual, preview/QA del correo,
aplicación dirigida de SQL/Auth templates, deploy de funciones y frontend,
verificación productiva y documentación de evidencia.
