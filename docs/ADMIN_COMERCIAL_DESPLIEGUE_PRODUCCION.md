# Gestión comercial — recuperación y despliegue en producción

Fecha: 2026-10-10.

**Estado posterior:** gestión comercial habilitada a las 13:54 Argentina con
autorización nueva, contacto real verificado y trial/Básico ARS 1 preservados.
Ver [evidencia de habilitación](ADMIN_COMERCIAL_HABILITACION_PRODUCCION.md).
Este documento conserva la evidencia del despliegue inicial en lectura.

## Autorización y recuperación

El usuario autorizó desplegar las dos funciones y el frontend manteniendo las
modificaciones comerciales deshabilitadas. Al encontrar un merge que eliminaba
Admin y dejaba conflictos, autorizó recuperar todo el estado anterior.

Se creó la referencia local `codex/safety-pre-admin-recovery-20261010` apuntando
a `2bda5a73d2ac8c4d26f951dc49f39e2e2302ab84`, y se revirtió ese merge respecto
de su primer padre, sin reescribir el historial. La recuperación se contrastó
con `df51109a206027a227e2ec85d6dcc481cb36efc1`: el índice coincidió exactamente
antes de añadir esta evidencia y retirar espacios finales de un archivo.

Volvieron rutas, sesión Admin, pantallas, helpers de autorización, pruebas,
configuración y documentación. Se retiraron seis cachés Python regeneradas y
el archivo de almacenamiento de preview añadido por el merge; son recuperables
en el commit/referencia preservados. Ninguna base de datos se restauró.

## Checks reales de la recuperación

- Vitest completo: **98 pruebas, 21 archivos, todas aprobadas**.
- Deno: **22 pruebas aprobadas**, más `deno check` de los dos endpoints.
- SQL sintético local en PGlite: **14 pruebas aprobadas**; no acceso productivo.
- Build Vite: aprobado, incluye el chunk `AdminOrganizationDetailPage` y las
  demás pantallas administrativas. Persisten avisos de chunks grandes y Browserslist.
- ESLint focal: cero errores, dos avisos Fast Refresh ya documentados.
- Sin marcadores de conflictos en los archivos; limpieza de espacios finales
  restaurados en `useSueldosData.ts`, sin cambios de comportamiento.
- La búsqueda de contraseñas conocidas y claves privilegiadas en el bundle
  generado no devolvió coincidencias.

## Backend publicado en modo lectura

Proyecto confirmado por CLI: `azqpyfoobpovqosbayvz`, Vittro.

Se configuró explícitamente `PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED=false` y se
desplegaron únicamente `platform-admin-query` y `platform-admin-organization`
con el empaquetador de API, sin ejecutar migraciones ni desplegar otras funciones.
La lista productiva posterior informó query versión **4** y organization versión
**1**, ambas ACTIVE y con `verify_jwt=true`. El endpoint de precios no se redeplegó
ni se modificó su switch.

POST sin JWT: **401** en ambos endpoints; JWT inválido: **401** en organization.
Preflight CORS de organization: **204**, permite exactamente
`https://www.vittro.com.ar` y el header `x-request-id`. El digest del secret
comercial coincide con SHA-256 de `false`, sin extraer su contenido.

Con sesión Admin real, las fichas devolvieron datos y `mutationsEnabled=false`,
reflejado en el aviso de lectura y los tres botones deshabilitados. No se envió
una mutación autenticada: el 503 server-side y el 403 tenant se probaron en los
contratos locales, pero no se certifican aquí como pruebas productivas directas.

## Frontend y pendientes

Vercel confirmó `barber-app`, repositorio `Luciano557/BarberApp`, rama productiva
`main`, dominio `www.vittro.com.ar` y despliegue anterior del commit `77d3552`.
El remoto productivo admite avance normal; no se usará push forzado.

Se publicó por avance normal de Git el commit
`17450d70d9abb40ea8b5c538e209b78dbec280b3`. Vercel mostró **Ready**, **Production / Current**,
dominio `www.vittro.com.ar` y ese mismo commit. Despliegue:
`BsuQ9uBFcLgTAG39VmMGePFn5YXe`; build remoto de 29 segundos, sin error.

QA autenticado en el dominio real, con la sesión iniciada por el usuario:

- Resumen cargó métricas; directorio cargó 34 organizaciones y las páginas
  1–25 / 26–34. Búsqueda sin coincidencias mostró vacío real; BarberMalza
  devolvió exactamente una fila. Durante refetch conservó datos anteriores.
- Fichas verificadas: acceso manual indefinido, trial vigente, trial vencido,
  contacto nulo, historial con una entrada y sin entradas. Fuente de acceso,
  importe configurado y evidencia de pago permanecen diferenciados.
- Tres acciones comerciales deshabilitadas y texto de modo lectura.
- Capturas reales a 390×844, 768×1024, 1024×768 y 1440×900. Sin overflow
  horizontal del documento; cards de historial en mobile y tabla en desktop.
  Se restauró el viewport original después de probar.
- Una pestaña abierta con el bundle anterior emitió un error de importación
  durante el cambio de versión. La navegación completa recargó el build nuevo,
  conservó la sesión Admin y Resumen/fichas volvieron a cargar. No se implementó
  recuperación automática de assets antiguos; recargar pestañas anteriores.

Capturas inspeccionadas en `.impeccable/review/admin-commercial/`:
`production-desktop.jpg`, `production-mobile.jpg`, `production-tablet-768.jpg`,
`production-tablet-1024.jpg` y `production-vercel.jpg`.
Permanecen locales y están excluidas de Git para no publicar capturas
autenticadas con metadatos de barberías. La evidencia de migración previamente
versionada no contiene fichas de clientes y no se alteró.

## Catálogo observado, sin intervención

Portada y Admin coincidieron en Básico **ARS 1 / v3**, Profesional **ARS 30.000 / v2**
y Premium **ARS 50.000 / v2**. El último lote visible registró Básico
ARS 20.000 → ARS 1, creado por la cuenta compartida `admin` a las **11:11 Argentina**,
antes de este despliegue. La UI lo mostró completo, 27/27 finalizados. No puede
atribuirse a una persona concreta usando una cuenta compartida. Se informó al
usuario; no se corrigió, reintentó ni aplicó un cambio de precio durante este trabajo.

## Límites del despliegue inicial en lectura

En esta primera publicación, el despliegue en lectura estaba verificado y las
escrituras comerciales estaban apagadas; la activación posterior figura arriba.
Antes de activarlas faltan barbería de prueba y operación acordadas, concurrencia
real, pruebas autorizadas de escritura/recuperación, denegación con cuenta tenant
y convivencia de dos sesiones autenticadas. No se probaron 1.000 usuarios reales,
webhooks ni un contrato MP activo en este QA. No se cambió Auth ni se llamó a MP.

La publicación se realizó en el remoto `production`. El remoto `origin`
(`tellosebastian-git/pixel-perfect-replica`) no se publicó en este paso; conservar
la recuperación local antes de integrar cambios posteriores desde ese remoto.

La migración ya aplicada no se volvió a ejecutar. Ver
[evidencia de migración](ADMIN_COMERCIAL_MIGRACION_PRODUCCION.md) y
[runbook de activación](ADMIN_COMERCIAL_ACTIVACION.md).
