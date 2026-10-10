# Gestión comercial — recuperación y despliegue en producción

Fecha: 2026-10-10.

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

POST sin JWT: **401** en ambos endpoints. La verificación autenticada del DTO,
el switch efectivo y el rechazo de escrituras sigue pendiente hasta publicar
el frontend y disponer de una sesión Admin real.

## Frontend y pendientes

Vercel confirmó `barber-app`, repositorio `Luciano557/BarberApp`, rama productiva
`main`, dominio `www.vittro.com.ar` y despliegue anterior del commit `77d3552`.
El remoto productivo admite avance normal; no se usará push forzado.

Publicación y QA autenticado todavía pendientes al crear esta evidencia. No se
habilitarán escrituras comerciales durante este rollout. Concurrencia real y
prueba comercial acordada siguen siendo requisitos antes de activarlas.

La migración ya aplicada no se volvió a ejecutar. Ver
[evidencia de migración](ADMIN_COMERCIAL_MIGRACION_PRODUCCION.md) y
[runbook de activación](ADMIN_COMERCIAL_ACTIVACION.md).
