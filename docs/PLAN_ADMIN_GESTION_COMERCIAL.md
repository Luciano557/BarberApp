# Admin — gestión comercial por barbería

Plan del 2026-10-10, aprobado explícitamente por el usuario antes del build.
El usuario eligió gestión por barbería primero y edición de barbería/contacto;
no catálogo/límites ni gestión de usuarios. La reconciliación puntual aprobada
de BarberMalza ya está cerrada y no depende de este desarrollo.

## Auditoría de la superficie vigente (solo lectura)

Estado observado antes del build, conservado como fundamento del plan. El estado
implementado localmente se registra en «Estado de ejecución» al final.

- `AdminOrganizationsPage` y `AdminUsersPage` son directorios sin ficha ni
  acciones de edición. La única escritura global implementada es precio/lote.
- Los DTO de organización no incluyen teléfono/dirección, pese a existir en
  `organizations`; tampoco hay email comercial independiente del login Auth.
- La organización sin vencimiento se presenta como `legacy` en las vistas,
  y la tabla de barberías usa «Acceso pago». No distingue adecuadamente una
  cortesía/manual de un contrato autorizado. El importe histórico no prueba pago.
- Hay sesiones, helper de autorización, auditoría, CAS y patrones de DrawerForm
  reutilizables; no existe una API de mutaciones comerciales por organización.
- La RPC de acceso tenant del repositorio no considera `organizations.is_active`
  y el helper de facturación no lo consulta. Esto impide prometer que un switch
  administrativo, por sí solo, suspende efectivamente acceso/API. Hace falta
  contraste dirigido de las definiciones productivas, RLS y sesiones vigentes.
- La RPC de acceso existente es `SECURITY DEFINER`. Modificarla requiere
  reportar el cambio y autorización específica antes de aplicar, por Lovable.
  La excepción autorizada para BarberMalza no habilita esos futuros cambios.
- La entrega de webhooks firmados permanece pendiente; no se debe ampliar la
  mutación de contratos MP a partir del cierre de un único checkout obsoleto.

## Resultado y experiencia propuestos

Para los operadores internos de Vittro, modo Operate: encontrar una barbería,
entender por qué tiene acceso y efectuar una acción comercial con consecuencias
claras. Conservar Inter, navy, shell y componentes de `DESIGN.md`, sin rediseño.

Ficha en `/admin/barberias/:organizationId`, abierta desde el nombre o una acción
«Ver detalle» accesible tanto en tabla como en cards. Tres bloques: datos y
contacto, acceso/suscripción, historial administrativo. Siempre mostrar fuente
del acceso (trial/manual/MP), plan efectivo, vencimiento y estado de facturación
por separado. No mostrar clientes, ventas, caja ni finanzas tenant.

Las acciones abren `DrawerForm`, con RHF/Zod, motivo, resumen anterior/nuevo y
confirmación. Cambios comerciales/suspensión requieren reautenticación. Lecturas
usan skeleton demorado, conservación durante refetch y error inline; una escritura
ambigua exige consultar el request ID antes de repetir. Un único card contiene
toolbar/resultados con `overflow:clip`; desktop tabla y mobile cards equivalentes.

En la entrega comercial aprobada, todas las escrituras, incluida edición de
contacto, requieren motivo, contraseña y confirmación del impacto. Suspensión
queda diferida hasta probar enforcement servidor y resolver su autorización.

## Fases propuestas

### 1. Backend comercial, sin build visual

- Ampliar lectura con una operación tipada `organization_detail`, DTO permitido
  y auditoría filtrada por organización. No exponer metadata/payloads completos.
- Crear endpoint comercial separado, siempre protegido por el helper de rol
  vigente, y kill switch independiente inicialmente deshabilitado.
- Acciones: editar nombre/teléfono/dirección; asignar plan manual; extender trial.
  Nombre/contacto de organización puede reflejarse en la app; no cambiar slug,
  URL pública, sucursales ni email/password de Auth en esta fase.
- Resolver email de contacto comercial en un campo explícito separado de Auth
  mediante migración por Lovable. No copiar por defecto emails de todo el equipo.
- Asignación manual: Básico/Profesional/Premium, vencimiento explícito u opción
  sin vencimiento claramente confirmada. Solo organizaciones manuales o sin
  contrato MP vigente y sin checkout pendiente sin reconciliar. No fabricar
  pagos, cambiar el catálogo ni tomar el importe histórico como débito real.
- Si hay contrato MP autorizado, rechazar la conversión manual con explicación;
  no cancelar ni modificar cobros automáticamente. Gestionar ese contrato
  requiere una fase de facturación separada y validación real de webhooks.
- Extender trial por fecha futura, sin acortar ni reemplazar acceso pago/manual.
  Tratar explícitamente trial vencido y no reutilizar checkout antiguo.
- RPC transaccional `SECURITY INVOKER`, solo `service_role`, con organización
  exacta, `updated_at` esperado, motivo, actor, request ID único e idempotencia.
  Auditoría anterior/nueva en la misma transacción; conflicto devuelve 409.
- Plan/proveedor/período y proyección tenant deben mantener invariantes; locks
  coordinados con worker y webhooks. No otorgar roles ni ampliar claims.

### 2. Suspensión/reactivación efectiva, backend separado

- Auditar las guardas de acceso, RLS, funciones service-role, canales Realtime,
  reservas públicas y sesiones ya abiertas antes de definir un alcance exacto.
- Definir suspensión de acceso interno sin borrar datos, cancelar contratos ni
  detener cobros silenciosamente. La confirmación debe advertir esos efectos.
- Hacer cumplir la suspensión del lado servidor; deshabilitar solo botones o
  navegar fuera de la app no cuenta como suspensión efectiva.
- Reactivación respeta las fechas/plan vigentes: no extiende acceso vencido.
- Cambios DB/RLS van por Lovable; si requieren tocar SECURITY DEFINER, detenerse
  y pedir autorización específica. No usar la excepción anterior como permiso.

### 3. Build visual, sin cambios de datos

Ficha, enlaces de detalle, acciones en tabla/cards, drawers y estados contra
fixtures: trial vigente/vencido, manual temporal/indefinido, MP autorizado,
checkout pendiente, suspendida, datos nulos, fallo y conflicto. Conservar identidad
Operate y explicar bloqueos con copy accionable, no mensajes genéricos.

### 4. Integración y activación

Conectar contratos tipados, invalidar solamente caches relevantes y verificar
aislamiento de sesiones/tenants. Probar CAS, doble envío, actor tenant rechazado,
vencimientos, bloqueo ante MP autorizado y ausencia de pagos ficticios. QA
autenticado en 390, 768/1024 y 1440 px, pruebas Vitest/RTL y Deno, build/lint focal.
Publicar primero la ficha en lectura y luego activar las escrituras comerciales;
el switch implementado habilita contacto/manual/trial conjuntamente. Suspensión
solo después de demostrar su enforcement. Documentar cada build cerrado.

## Fuera de alcance

Crear/eliminar/bloquear usuarios; cambiar contraseñas o email de login; roles
tenant; administradores nominales; impersonación; edición del catálogo de
funciones/límites; ventas/clientes/finanzas; cobros/reembolsos y cambios automáticos
de contrato MP. MFA y administradores nominales siguen recomendados para futuras
expansiones de privilegios.

## Estado de ejecución — 2026-10-10

Backend comercial (etapa 1), ficha/drawers (etapa 3) e integración tipada de la
etapa 4 terminados y validados **localmente**, en builds separados. La suspensión
de etapa 2 sigue diferida. Migración aplicada directamente en producción con
excepción explícita nueva, en una transacción, el 2026-10-10 a las 13:08:48 UTC;
endpoint nuevo y frontend comercial publicados posteriormente con nueva
autorización y QA autenticado de lectura. Las escrituras
quedan explícitamente apagadas (`PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED=false`,
independiente). No se modificó ninguna función `SECURITY DEFINER` existente
ni contratos MP.

### Artefacto construido

- Ruta `/admin/barberias/:organizationId` con enlace desde nombre en tabla/card;
  `AdminOrganizationDetailPage`, `OrganizationDetailView`,
  `OrganizationCommercialDrawer` y `OrganizationHistory` en `src/admin/`.
- Datos/contacto separados de fuente del acceso, plan efectivo, vencimiento y
  facturación. El importe configurado no se presenta como evidencia de pago.
  Auditoría filtrada por organización/suscripción con paginación; tabla
  desktop/tablet y cards mobile. Ningún dato operativo tenant.
- Edición de nombre/teléfono/dirección/email comercial privado, asignación
  manual con futuro vencimiento o cortesía indefinida explícita y extensión de
  trial sin pago aprobado. Refs/contratos MP, checkouts y fences pendientes
  bloquean las mutaciones de acceso; no producen cancelaciones automáticas.
- `DrawerForm` con RHF/Zod, descarte protegido, motivo, contraseña y resumen de
  impacto en cada escritura. `DatePicker`/`TimePicker` canónicos conservan
  minutos libres; validación inline y estados lectura, conflicto y resultado
  ambiguo tienen copy específico.
- `src/hooks/usePlatformAdmin.ts` conecta contratos tipados, sin retry automático
  de escrituras, con invalidación de caches relevantes y contraseña fuera de
  caché/DevTools. `src/admin/commercialRecovery.ts` guarda solo request ID/acción
  por actor y barbería en `sessionStorage`; antes de repetir se consulta `status`.

Es una extensión de `/admin` dentro del mundo Operate Inter/navy vigente.
`DESIGN.md` y `.impeccable/design.json` se preservan: no se aprobó rediseño ni un
nuevo sistema visual. El card de colección y los formularios reutilizan los
patrones canónicos; los criterios visuales no se redefinen en este plan.

### Evidencia y alcance de validación

Build exitoso; 36 pruebas Vitest en 8 archivos; 22 pruebas Deno
(6 Admin + 16 comerciales); 14 integraciones SQL en PostgreSQL/WASM con datos
sintéticos; `deno check` de los dos endpoints. Lint focal sin errores y dos
warnings Fast Refresh. TypeScript global mantiene cinco errores preexistentes
fuera de los archivos cambiados. Las pruebas SQL comprueban grants/RLS, rollback
de auditoría, CAS con microsegundos, idempotencia, proyección tenant y bloqueos
de facturación. No simulan conexiones Postgres paralelas ni entrega real de
webhooks.

Fixtures de QA en `qa/admin-commercial.tsx`, solo para Vite dev, sin entrada de
build productivo. Once capturas locales en
`.impeccable/review/admin-commercial/`: `desktop`, `mobile`, `tablet-768`,
`tablet-1024`, `user-1280`, `mobile-drawer`, `mobile-validation`, `trial-expired`,
`trial-drawer`, `mp-blocked` y `readonly` (archivos `.jpg`). Viewports revisados:
1440×900, 390×844, 768×1024, 1024×768 y 1280×720. Se verificaron minuto libre
`14:37` preservado y fecha futura. Son datos sintéticos, sin escrituras productivas.

Revisión independiente Impeccable cerrada con `ship` después de resolver sus
tres hallazgos: pickers canónicos de fecha/hora, consecuencias legibles de 14px
y títulos de cards de 18px. Las once recapturas se validaron. El detector se
ejecutó una vez antes del cierre, señaló dos usos legacy de 11px y se corrigieron;
no se afirma una segunda ejecución. La revisión cerrada cubre esas tres
correcciones, no certifica producción ni el ciclo real de facturación. No se
crearon nuevos assets raster; las capturas son evidencia QA.

Para reproducir SQL local sin Docker ni credenciales:

```powershell
npm install --prefix node_modules/.admin-sql-test --no-package-lock --no-save @electric-sql/pglite@0.5.8
node supabase/tests/admin-commercial-sql.mjs
```

La prueba lee la migración candidata y definiciones reales de tablas/triggers
del repositorio. Solo crea una base en memoria; no se conecta a Supabase.
La extensión de trial permite períodos nulos o reflejados exactamente desde
las fechas originales de trial; rechaza un período distinto o cualquier pago
aprobado y conserva la proyección al extender el vencimiento.

### Despliegue en lectura cerrado; activación pendiente

El backend y frontend se publicaron con nueva autorización, recuperación del
merge roto y switch comercial apagado. La lectura se verificó con sesión Admin
real a 390/768/1024/1440 px; ver
[ADMIN_COMERCIAL_DESPLIEGUE_PRODUCCION.md](ADMIN_COMERCIAL_DESPLIEGUE_PRODUCCION.md).
Seguir [ADMIN_COMERCIAL_ACTIVACION.md](ADMIN_COMERCIAL_ACTIVACION.md) desde el paso 4:
migración ya aplicada y verificada, pruebas restantes de aislamiento/recuperación,
concurrencia con conexiones reales y una prueba comercial acordada
antes de habilitar. El switch habilita contacto/manual/trial conjuntamente;
no implementa suspensión ni modifica el switch de precios.

La aprobación del plan y la excepción de BarberMalza no bastaban para aplicar
la migración directamente: el usuario dio una autorización nueva, acotada a este
archivo y una transacción. Evidencia:
[ADMIN_COMERCIAL_MIGRACION_PRODUCCION.md](ADMIN_COMERCIAL_MIGRACION_PRODUCCION.md).
DB/RLS futuras van por Lovable o requieren otra excepción explícita. Suspensión necesita
auditoría y enforcement servidor separado; si requiere un `SECURITY DEFINER`,
detenerse y obtener autorización específica antes de aplicar. La matriz de
webhooks firmados sigue pendiente y no queda validada por el QA local.
