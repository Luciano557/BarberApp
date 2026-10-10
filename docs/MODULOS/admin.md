# Centro de administración de plataforma

## Estado de rollout

**Desplegado en producción y con mutaciones de precio habilitadas desde el
2026-09-08.** La migración, la cuenta técnica, el frontend y las Edge Functions
están aplicados en el entorno productivo. Se verificaron el acceso autenticado,
los endpoints administrativos y la política CORS para
`https://www.vittro.com.ar`.

La extensión comercial del 2026-10-10 tiene backend, ficha e integración tipada
terminados y validados localmente. La migración comercial se aplicó en producción
con excepción directa autorizada el 2026-10-10, en una sola transacción; la RPC,
RLS y grants se comprobaron de forma independiente. El endpoint nuevo y frontend
comercial no se desplegaron; no se habilitaron escrituras.
La activación requiere seguir [el runbook comercial](../ADMIN_COMERCIAL_ACTIVACION.md).

`PLATFORM_ADMIN_PRICE_MUTATIONS_ENABLED` está en `true`. El 2026-09-08 se
ejecutaron tres cambios reales y el catálogo quedó en Básico ARS 20.000,
Profesional ARS 30.000 y Premium ARS 50.000, todos en `price_version = 2`.
Homepage y Registro fueron verificados contra esos importes. El caso de Básico
quedó reconciliado el 2026-10-10. Facturación, `SubscriptionGate` y el webhook
posterior continúan pendientes de validación.

La migración es `supabase/migrations/20260904153000_platform_admin_center.sql`.
Modifica una función `SECURITY DEFINER` preexistente (`handle_new_user`), por lo
que fue aplicada como una excepción puntual autorizada, en una sola transacción
y sin ejecutar otras migraciones. No debe reaplicarse durante el rollout.

Preflight productivo registrado antes de habilitar las mutaciones:

- Catálogo: Básico ARS 30.000, Profesional ARS 60.000 y Premium ARS 100.000;
  todos en `price_version = 1`.
- Había 29 suscripciones locales `active` y 4 `trialing`.
- Solo una suscripción activa tenía `preapproval` de Mercado Pago; su estado
  local del proveedor era `pending`, por lo que no debe asumirse como una
  renovación autorizada sin revalidar el preview y el proveedor.
- No existían lotes, ítems ni eventos de auditoría de cambio de precio. El
  intento que devolvió `503 MUTATIONS_DISABLED` no modificó el catálogo.

Resultado de los cambios reales del 2026-09-08:

- **Básico:** ARS 30.000 → ARS 20.000, versión 2, lote `partial`. De sus 27
  ítems, 26 terminaron `skipped` por `missing_preapproval` y 1 terminó `failed`
  por `provider_not_active`. Este caso requiere reconciliación antes de dar por
  validada la propagación del plan.
- **Profesional:** ARS 60.000 → ARS 30.000, versión 2, lote `complete` sin
  ítems elegibles.
- **Premium:** ARS 100.000 → ARS 50.000, versión 2, lote `complete`. Terminó
  con 1 ítem exitoso y 2 `skipped` por `provider_not_supported`.
- Totales: 3 lotes, 30 ítems y 6 eventos de auditoría. No quedaron ítems
  `pending` ni checkouts pendientes reutilizables.

El impacto debe recalcularse con `preview` inmediatamente antes de confirmar
cada cambio. El rollback operativo del permiso es volver a configurar
`PLATFORM_ADMIN_PRICE_MUTATIONS_ENABLED=false`; esto bloquea nuevas acciones
`apply`, `process` y `retry`, pero no revierte precios ni efectos externos que ya
hayan sido confirmados.

## Reconciliación puntual de BarberMalza — 2026-10-10

Excepción directa de producción aprobada explícitamente por el operador después
de revisar el caso; no amplía el permiso a otras suscripciones ni a migraciones.
La credencial productiva de la aplicación Vittro coincidió por SHA-256 con el
secret de suscripciones configurado en Supabase. El proveedor confirmó el mismo
vendedor (`collector_id = 265810177`) y aplicación (`3847322984949546`), sin
necesidad de rotar credenciales o cambiar de cuenta.

La suscripción de BarberMalza (`b7948334-db00-47e3-bdb6-e235a0715740`)
conservaba intención manual de Básico sin vencimiento, pero estaba clasificada
como `mercadopago` y vinculada al checkout antiguo
`f30e86b1897d44b592026b8b6c52d008`. El GET real devolvió `pending`, Premium por
ARS 100.000, con referencia externa de la misma organización pero de Profesional.
La búsqueda de facturas del proveedor y la tabla local de pagos devolvieron cero.
No era una renovación autorizada de Básico.

Ejecución y evidencia:

- Se verificaron vendedor, aplicación, referencia exacta, importe, moneda,
  estado pendiente y cero facturas inmediatamente antes del efecto externo.
- El proveedor rechazó `status: canceled` con 400 de validación; aceptó
  `status: cancelled` con PUT 200. El GET posterior confirmó `cancelled` y cero
  facturas a las `2026-10-10T11:40:51.532Z`.
- El SQL acotado se probó primero con `ROLLBACK` y se ejecutó luego en una sola
  transacción con locks, comparación de `updated_at` y validación del actor.
  No se crearon funciones, grants, policies ni migraciones.
- Se cambió solo el proveedor a `manual` y se limpiaron id, referencia, estado,
  enlace y próxima fecha de Mercado Pago. Básico, estado `active`, vencimiento
  nulo, motivo manual y snapshots históricos ARS 30.000 / versión 1 permanecen.
  Ese snapshot y `last_payment_at` legacy no prueban un cobro; no se fabricaron pagos.
- Las RPC existentes `platform_admin_retry_price_change_items`, limitada al
  único ítem, y `platform_admin_refresh_price_change_batch` cerraron el lote
  `b0470a1f-8f6c-4b1e-95ea-aff6803a02dc` como `completed`: 27 excluidos, cero
  fallos. Son 26 `missing_preapproval` y 1 `subscription_changed`; no son 27
  renovaciones actualizadas. Hay cero lotes abiertos de Básico.
- Dos auditorías `succeeded` comparten request ID
  `40df75c2-2680-4b9c-8fb5-21f38a6be1bb`: `subscription.provider_reconciled` y
  `subscription_price_change.reconciled`. La lectura independiente posterior
  confirmó persistencia y catálogo intacto. Una segunda ejecución fue un no-op:
  mismo `updated_at`, dos auditorías, sin duplicados.

Script de evidencia: `supabase/diagnostics/20261010_reconcile_barbermalza.sql`.
Es una operación puntual ya ejecutada, no un paso pendiente ni una migración.
No permite revertir automáticamente una cancelación externa.

Pendiente separado: el panel de Mercado Pago mostraba la URL global `mp-webhook`,
cuyo handler local no procesa suscripciones, mientras el secret específico apunta
a `subscription-mp-webhook`. No se modificaron esas URLs ni se comprobó entrega
real de un webhook firmado. Cerrar este lote no valida el ciclo de facturación.

La ampliación solicitada se limita primero a gestión por barbería y datos de
contacto, sin administración de usuarios/Auth. Su plan está en
[PLAN_ADMIN_GESTION_COMERCIAL.md](../PLAN_ADMIN_GESTION_COMERCIAL.md); está
implementada localmente, con activación productiva pendiente. La migración
comercial requirió y recibió una autorización directa nueva, separada de
BarberMalza; ninguna de esas excepciones autoriza otros cambios DB/RLS.

## Propósito y alcance v1

`/admin` es el plano de control interno de Vittro. Permite observar la salud
comercial global y operar cambios de precio sin entrar a la aplicación de una
barbería ni consultar sus datos operativos.

Incluye:

- Resumen de barberías con acceso, MAU 30 días, cobros aprobados e incidencias.
- Barberías, con búsqueda y filtros de plan/estado.
- Usuarios tenant, roles, fecha de alta, último ingreso y condición MAU.
- Planes, suscripciones y pagos de plataforma.
- Edición auditada del precio de un plan y propagación a Mercado Pago.
- Auditoría administrativa y seguimiento/reintento de lotes.

No incluye en v1 datos operativos, clientes finales, ventas, cajas o finanzas de
las barberías; impersonación; extensión manual de trials; asignación manual de
planes; suspensión de organizaciones; bloqueo/reset de usuarios; conciliación
manual; ni administración de cuentas de plataforma.

La extensión comercial local agrega ficha, edición de nombre/teléfono/dirección
y email comercial privado, asignación manual de Básico/Profesional/Premium y
extensión de trial elegible. Suspensión, usuarios/Auth y datos operativos siguen
fuera de esta entrega. Su estado local no modifica el alcance desplegado de v1.

## Rutas y composición

| Ruta | Contenido |
|---|---|
| `/admin/login` | Acceso con alias administrativo y contraseña |
| `/admin` | Resumen global |
| `/admin/barberias` | Listado de organizaciones |
| `/admin/barberias/:organizationId` | Ficha comercial, contacto, acceso e historial; extensión local pendiente de activar |
| `/admin/usuarios` | Listado de cuentas tenant |
| `/admin/suscripciones` | `Planes`, `Suscripciones` y `Pagos` |
| `/admin/auditoria` | Acciones administrativas y resultado de lotes |

El árbol Admin se monta antes y fuera de `OrganizationProvider`,
`SucursalProvider`, onboarding y `SubscriptionGate`. Usa `AdminShell` y no
reutiliza `AppSidebar`, `Login`, `UserManagement` ni `BillingSettings`, porque
esas piezas tienen supuestos de tenant que no deben entrar al plano de control.

## Identidad, sesión y autorización

- El alias visible es `admin`. No es un email ni un rol de base de datos.
- `VITE_PLATFORM_ADMIN_EMAIL` resuelve ese alias al email técnico de una cuenta
  dedicada de Supabase Auth. El email puede formar parte del bundle; la
  contraseña nunca.
- La cuenta debe estar confirmada, vigente y tener
  `app_metadata.platform_role = "platform_admin"` asignado desde un entorno
  server-side. El permiso no se guarda en `app_role` ni `user_roles`.
- `handle_new_user` retorna antes del provisioning tenant para ese claim: la
  cuenta no crea organización, sucursal, perfil owner ni trial.
- El cliente Supabase de Admin usa `sessionStorage`, una clave propia y
  `detectSessionInUrl: false`. Puede convivir con la sesión tenant del cliente
  principal.
- Tras 30 minutos sin actividad se cierra únicamente la sesión local de Admin y
  se limpia su caché React Query.
- El guard React es solo UX. Cada Edge Function vuelve a comprobar bearer JWT,
  usuario actual y claim vigente antes de inicializar `service_role`.
- Mensajes de acceso no distinguen alias inexistente, contraseña incorrecta o
  falta de rol. La credencial no se registra en logs ni auditoría.

La identidad compartida permite atribuir acciones a `admin`, no a la persona
física que la realizó. MFA y administradores nominales quedan recomendados para
una fase posterior, especialmente antes de sumar más mutaciones.

## Contratos backend

### `platform-admin-query`

Operaciones públicas tipadas:

- `overview`
- `organizations`
- `users`
- `subscriptions`
- `payments`
- `audit`
- `price_change_status`
- `organization_detail` — extensión local: UUID exacto, contacto permitido,
  fuente/plan/período de acceso y capacidades comerciales del servidor.

Los listados responden `{ items, page, pageSize, total }`, aceptan búsqueda,
filtros y orden procesados en servidor, y limitan `pageSize` a 50. La lectura de
Supabase Auth pagina hasta agotar usuarios, por lo que no se trunca en el límite
habitual de 1.000. Los DTO usan una lista permitida de campos: no exponen
`raw_payload`, tokens, metadata arbitraria ni información operativa de tenants.
Las métricas y colecciones operativas se resuelven sobre vistas de lectura
`platform_admin_*_v`, revocadas a `anon`/`authenticated`, para paginar, ordenar y
agregar en Postgres. Solo el cruce de `last_sign_in_at` para MAU se completa en
Edge mediante Auth Admin, porque ese dato no pertenece al esquema público.

### `platform-admin-price-change`

Acciones:

- `preview`: devuelve plan actual, impacto, renovaciones elegibles, checkouts
  pendientes y exclusiones; no requiere habilitar mutaciones.
- `apply`: reautentica la misma cuenta con la contraseña ingresada, verifica el
  catálogo esperado y crea el cambio/lote transaccional.
- `process`: reclama un grupo acotado y sincroniza sus objetivos con Mercado
  Pago.
- `retry`: reabre ítems fallidos o interrumpidos válidos y exclusiones por
  `preapproval` faltante cuando la referencia ya fue reparada.

Todas las acciones excepto `preview` están bloqueadas mientras
`PLATFORM_ADMIN_PRICE_MUTATIONS_ENABLED` no sea `true`.

### `platform-admin-organization` — extensión local

Acciones `update_details`, `assign_manual_plan`, `extend_trial` y consulta `status`
por organización + request ID. Las escrituras requieren motivo, contraseña de
la misma cuenta administrativa, revisión esperada de organización/suscripción
y confirmación de impacto en la UI. La reautenticación usa una sesión efímera
independiente; la contraseña no entra en caché, almacenamiento ni auditoría.

`PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED` ausente o distinto de `true` bloquea las
tres escrituras; `status` sigue disponible en lectura. Este permiso es
independiente del switch de precios y no está habilitado en producción.
La auditoría de la ficha se filtra por organización y su suscripción mediante
la operación `audit`; no trae el historial global ni datos operativos tenant.

La RPC candidata `platform_admin_manage_organization` es `SECURITY INVOKER`,
ejecutable solo por `service_role`, con CAS de ambas revisiones, request ID
idempotente y cambio/auditoría atómicos. El helper valida el rol antes de usar
`service_role`; no se confía en RLS como único control de acceso del endpoint.

## Modelo de control

Las siguientes tablas tienen RLS activa, ninguna policy de acceso para
`anon`/`authenticated` y privilegios reservados a `service_role`:

- `platform_admin_audit_log`: actor, alias, acción, objetivo, motivo, estado
  anterior/siguiente permitido, resultado, request ID y fecha. Registra
  mutaciones administrativas, no intentos de login ni secretos.
- `subscription_price_change_batches`: plan, importes/versiones, estado,
  contadores, actor, motivo y timestamps del lote.
- `subscription_price_change_items`: objetivo de renovación o checkout,
  `preapproval`, referencia externa congelada, claim, tipo de mutación externa,
  revisión exacta de la suscripción, intentos normales/de compensación, resultado
  y error sanitizado.

La migración comercial aplicada agrega `platform_admin_organization_contacts`,
separada de Auth: RLS activa, sin policies tenant y permisos SELECT/INSERT/UPDATE
solo para `service_role`. Conserva email comercial privado por organización;
no contiene datos operativos de sucursal. Aplicada en producción con excepción
directa autorizada, en una sola transacción, el 2026-10-10. Tabla vacía y grants
verificados; su API/frontend todavía no están desplegados.

`subscription_plans.price_version` identifica la versión del precio.
`organization_subscriptions` conserva `billing_amount_ars`,
`billing_price_version`, `pending_checkout_amount_ars` y
`pending_checkout_price_version` para distinguir catálogo actual, contrato
vigente e intención de checkout.

Las RPC nuevas son `SECURITY INVOKER`, revocadas a `anon` y `authenticated`, y
ejecutables solo por `service_role`. Incluyen creación/reclamo/finalización/retry
de lotes, el fence y la compensación de mutaciones externas, y finalizadores CAS
para checkout, cambios programados, reactivación y cancelación.

## Semántica de métricas

- **Barbería con acceso:** organización habilitada con trial vigente o período
  de suscripción vigente. No equivale a `status = active` aislado de fechas.
- **MAU 30 días:** cuenta tenant cuyo `last_sign_in_at` cae dentro de los últimos
  30 días. Excluye identidades con rol de plataforma y no significa “online”.
- **Cobro aprobado 30 días:** pago `approved` cuya fecha efectiva es `paid_at`
  cuando existe; la creación es solo fallback.
- **Incidencias:** incluye pagos/suscripciones estancados, fallos de lotes,
  rechazos recientes y webhooks sin procesar dentro de los umbrales del backend.
- **Estados:** trial, vigente, vencida, cancelada y legacy se muestran por
  separado; no se colapsan bajo una etiqueta genérica de “activa”.

## Fuente única y cambio de precios

`subscription_plans.amount_ars` es la única fuente de precio. Homepage,
Registro, Facturación, `SubscriptionGate` y checkout leen el mismo catálogo; el
campo `plan_features.price_monthly` se elimina al aplicar la migración. La
migración lleva Profesional a ARS 60.000 mediante el mismo mecanismo auditable,
solo si el importe anterior difiere.

Flujo de una modificación:

1. Admin abre un `DrawerForm` y solicita un preview.
2. Confirma un importe ARS positivo, un motivo de 10–500 caracteres, el impacto
   y su contraseña. La contraseña solo viaja en esa solicitud de reautenticación
   y no se persiste.
3. `apply` compara importe, `price_version` y `updated_at`. Si otra sesión cambió
   el catálogo, responde conflicto y obliga a refrescar.
4. Una RPC bloquea el plan y las suscripciones afectadas, incrementa la versión,
   actualiza el catálogo, crea el lote/ítems e invalida todo checkout pendiente
   anterior en la misma transacción.
5. El worker reclama hasta 20 pendientes y procesa con concurrencia máxima 5.
   Reintenta red, 408, 429 y 5xx hasta tres intentos; los errores permanentes
   quedan visibles.
6. Antes de cada `PUT /preapproval/{id}` revalida organización, suscripción,
   plan e identificador; recupera y congela una referencia externa faltante
   solo si el proveedor prueba el mismo tenant/plan; y persiste el tipo de
   mutación junto con la revisión local exacta antes del efecto externo.
7. Una caída o respuesta externa ambigua conserva el fence y se retoma con el
   mismo efecto idempotente. Si la revisión local cambió, el mismo ítem restaura
   la intención vigente o completa el precio nuevo si la suscripción sigue
   siendo elegible. La compensación también tiene CAS y retry.
8. Cada resultado completa su ítem de forma idempotente. El lote solo termina
   cuando todos los elegibles llegaron a estado terminal; fallos o interrupciones
   se pueden reabrir sin duplicar efectos.

Los checkouts pendientes se convierten en tombstones inmutables y se cancelan
en Mercado Pago; si un pago ganó la carrera y promovió el checkout antes de la
invalidación, el worker lo reconoce como renovación activa y aplica el importe
nuevo al próximo débito. Los éxitos parciales no revierten el catálogo: Mercado Pago no ofrece una
transacción global y algunas renovaciones ya pueden haber cambiado. El operador
ve el resultado y reintenta los objetivos pendientes. Los checkouts de una
versión anterior se invalidan o reemplazan; nunca se reutilizan por conveniencia.
Un downgrade programado mantiene separado el plan de facturación actual del
plan/importes previstos para la próxima renovación.

## Checkout y webhook de Mercado Pago

Un checkout existente solo se reutiliza si coinciden plan, importe, versión,
ARS, estado pendiente y referencia de organización tanto localmente como en
Mercado Pago. Si el catálogo cambia durante la creación, la finalización
transaccional rechaza el snapshot y la función cancela el `preapproval` recién
creado.

El webhook:

- exige `MERCADOPAGO_WEBHOOK_SECRET` y valida HMAC y frescura del timestamp;
- permite omitir firma únicamente con
  `MERCADOPAGO_ALLOW_UNSIGNED_WEBHOOKS=true` junto con
  `MERCADOPAGO_ENVIRONMENT=sandbox`;
- persiste eventos con unicidad, reanuda duplicados todavía no procesados y
  devuelve error reintentable cuando la sincronización no termina;
- compara importe, moneda, plan, referencia, vínculo y orden temporal antes de
  extender acceso;
- usa CAS por `updated_at` para evitar carreras entre eventos;
- no retrocede períodos ante pagos antiguos y conserva una intención pendiente
  ante rechazos recuperables;
- persiste y audita cobros de vínculos obsoletos, cancela esos vínculos y nunca
  los usa para otorgar acceso;
- acepta un cobro legítimo con el importe inmediatamente anterior si quedó en
  vuelo durante un lote ya confirmado, mantiene el snapshot nuevo para el
  próximo débito y genera una incidencia auditable;
- primero confirma por CAS la promoción del checkout nuevo y deja un marcador
  durable del vínculo anterior; recién después lo cancela, de modo que un retry
  pueda terminar la limpieza sin cancelar la suscripción todavía vigente.

## Experiencia y responsive

Admin usa Inter, navy, tokens semánticos, radios y elevación del modo Operate.
El shell es propio. Desktop/tablet presentan tablas densas; mobile transforma la
misma información en cards. Toolbar y panel de resultados comparten un único
card con `overflow:clip`. La edición de precio nunca es inline.

Las lecturas aplican delayed skeleton solo en la primera carga, conservan datos
anteriores durante refetch, muestran `InlineReadError` si no existe contenido
utilizable y reservan el empty state para una ausencia confirmada. Los errores
técnicos y respuestas completas del proveedor no se muestran al operador.

La ficha local se abre desde el nombre de barbería en tabla o card. Separa
«Datos y contacto», «Acceso y suscripción» e historial administrativo paginado:
fuente del acceso, plan efectivo, vencimiento y facturación son datos distintos;
un importe configurado no prueba un pago. El historial conserva motivo, cambio,
actor, resultado y request ID en tabla desktop/tablet y cards mobile.

Las tres acciones comerciales usan `DrawerForm` con RHF/Zod, confirmación de
descarte, resumen de consecuencias, motivo y contraseña. El vencimiento usa
`DatePicker`/`TimePicker` canónicos y admite minutos libres. Conflicto obliga a
refrescar; un resultado ambiguo conserva solo ID/acción en `sessionStorage`,
separados por actor y organización, y exige consultar `status` antes de repetir.
El modo lectura y los bloqueos comerciales tienen explicación visible.
Esta es una extensión del mundo Operate vigente; `DESIGN.md` y su sidecar
permanecen como fuente visual, sin un sistema paralelo.

## Variables de entorno

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PLATFORM_ADMIN_EMAIL`

Edge Functions / secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PLATFORM_ADMIN_ALLOWED_ORIGINS`
- `PLATFORM_ADMIN_PRICE_MUTATIONS_ENABLED` — `true` en producción desde el
  2026-09-08; volver a `false` es el kill switch para bloquear nuevas mutaciones
- `PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED` — switch comercial independiente,
  apagado por defecto y sin habilitar en producción; no bloquea consultas `status`
- `APP_ORIGIN`
- `MERCADOPAGO_APP_ORIGIN`
- `MERCADOPAGO_SUBSCRIPTIONS_ACCESS_TOKEN` — preferido para suscripciones
- `MERCADOPAGO_ACCESS_TOKEN` o `MP_ACCESS_TOKEN` — fallbacks legacy del cliente
  compartido
- `MERCADOPAGO_CLIENT_ID` y `MERCADOPAGO_CLIENT_SECRET` — fallback OAuth
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS` — opcional; el backend limita el valor
  efectivo al rango 60–3600 segundos
- `MERCADOPAGO_ALLOW_UNSIGNED_WEBHOOKS` — solo sandbox; nunca producción
- `MERCADOPAGO_ENVIRONMENT` — debe ser exactamente `sandbox` para habilitar el
  modo sin firma; en cualquier otro entorno el webhook falla cerrado
- `MERCADOPAGO_SUBSCRIPTION_WEBHOOK_URL` — opcional si no se deriva del proyecto

`APP_ORIGIN` y `MERCADOPAGO_APP_ORIGIN` siguen siendo orígenes reconocidos por el
helper compartido; `PLATFORM_ADMIN_ALLOWED_ORIGINS` permite declarar la lista
específica de Admin. Ninguna variable documentada debe contener la contraseña de
la cuenta en el repositorio o en un nombre `VITE_*`.

## Estado del despliegue en producción

- [x] Migración aplicada como única migración, en una sola transacción y con
  autorización explícita para el cambio de `handle_new_user`.
- [x] Constraints, índices, RLS, grants, RPC, backfill y funciones desplegadas
  verificados en producción.
- [x] Cuenta técnica confirmada con
  `app_metadata.platform_role = "platform_admin"` y sin datos tenant asociados.
- [x] Email técnico, secrets y origen de Admin configurados sin transportar la
  contraseña por el repositorio ni variables `VITE_*`.
- [x] `platform-admin-query`, `platform-admin-price-change` y las funciones de
  suscripción modificadas desplegadas.
- [x] Endpoints, CORS y autenticación de `/admin` verificados en producción.
- [x] Kill switch de precios habilitado el 2026-09-08.
- [x] Ejecutados tres cambios reales; verificados catálogo, lotes, auditoría y
  resultados diferenciados de Mercado Pago.
- [x] Homepage y Registro verificados con ARS 20.000 / 30.000 / 50.000.
- [x] Reconciliar el lote parcial de Básico: checkout obsoleto cancelado,
  BarberMalza manual y lote completado el 2026-10-10.
- [ ] Completar la matriz de renovación activa, checkout pendiente, conflicto,
  fallos transitorios, retry y webhook firmado.
- [ ] Verificar los precios y estados en Facturación y `SubscriptionGate`, además
  del webhook posterior a un cambio aplicable.
- [ ] Registrar QA responsive autenticado en 390, 768/1024 y 1440 px, incluida
  la convivencia y el cierre independiente de sesiones.

Si aparece un comportamiento inesperado durante una mutación, configurar
de inmediato `PLATFORM_ADMIN_PRICE_MUTATIONS_ENABLED=false`, conservar el lote y
la auditoría para diagnóstico y no intentar una reversión manual del catálogo o
de Mercado Pago sin reconciliar primero el estado de ambos sistemas.

## Criterios mínimos de aceptación de rollout

- La cuenta de plataforma no crea ningún dato tenant.
- JWT ausente devuelve 401; usuario tenant o claim inválido devuelve 403 en todas
  las APIs globales.
- La sesión tenant sobrevive a login, timeout y logout de Admin.
- La credencial no aparece en bundle, repositorio, respuestas, logs ni auditoría.
- Las métricas respetan sus fechas efectivas y excluyen identidades de plataforma.
- Paginación/búsqueda funcionan con 0, 1, 50 y más de 1.000 usuarios.
- Homepage, Registro, Facturación, `SubscriptionGate` y un checkout nuevo
  reflejan la misma versión/precio de catálogo.
- Un enlace viejo nunca se reutiliza; las renovaciones elegibles reciben el nuevo
  importe para su próximo débito.
- 429, 5xx, faltantes de `preapproval` e interrupciones quedan identificados y
  reintentables; reejecutar no duplica efectos ni auditoría.
- Dos cambios concurrentes no pisan el catálogo y los webhooks fuera de orden no
  retroceden el acceso.

## Gestión comercial por barbería — build local cerrado

Implementado y validado el 2026-10-10. **Migración aplicada en producción; sin
despliegue ni activación comercial**. Backend, contratos tipados, ficha, historial y drawers están
integrados en el código local. Archivos de referencia:
`src/admin/pages/AdminOrganizationDetailPage.tsx`,
`src/admin/components/OrganizationDetailView.tsx`,
`OrganizationCommercialDrawer.tsx`, `OrganizationHistory.tsx`,
`src/hooks/usePlatformAdmin.ts` y `src/admin/commercialRecovery.ts`.

Invariantes de la entrega:

- El email comercial no cambia Auth; no se modifica slug ni URL pública. Un
  acceso manual no genera pagos ni altera precios/contratos externos. Los
  snapshots de cobro anteriores quedan en auditoría, no en el contrato manual.
- Acceso manual exige plan Básico/Profesional/Premium y vencimiento futuro u
  opción indefinida explícitamente confirmada como cortesía.
- Vínculos MP (incluidos cancelados todavía presentes), checkouts y fences de
  compensación bloquean el cambio de acceso hasta una reconciliación explícita.
  Trial solo sin pago aprobado ni plan pago/manual y con períodos nulos o
  iguales a las fechas originales de trial. Extender nunca acorta acceso.

Validación local: build exitoso; 36 pruebas Vitest en 8 archivos; 22 Deno
(6 Admin + 16 comerciales); 14 integraciones SQL sintéticas en PGlite en memoria;
`deno check` de ambos endpoints. Lint focal sin errores y con dos warnings Fast
Refresh. TypeScript global conserva cinco errores previos fuera del cambio.
PGlite no demuestra concurrencia con conexiones reales ni entrega de webhooks.

QA visual local con fixtures sintéticos `qa/admin-commercial.tsx`, solo Vite dev
y fuera del build productivo. Las once capturas en
`.impeccable/review/admin-commercial/` cubren 1440×900, 390×844, 768×1024,
1024×768 y 1280×720, drawers, validación, trial vencido, bloqueo MP y lectura.
Se verificó minuto libre `14:37` y vencimiento futuro. La revisión independiente
cerró con `ship` sus tres correcciones: pickers canónicos, consecuencias de 14px
y títulos de cards de 18px. Esa revisión y las recapturas no certifican la sesión,
el backend ni el rollout productivos. No se generaron nuevos assets raster;
las imágenes son evidencia QA.

Migración `20261010130000_platform_admin_commercial.sql` aplicada directamente
con autorización explícita nueva en una transacción y registrada en historial.
Commit 13:08:48 UTC; lectura independiente 13:10:32 UTC confirmó archivo/cuerpo,
RLS, policies y grants. Los conteos de organización/suscripción/pagos/auditoría/
lotes/ítems y el catálogo no cambiaron. No se llamó a la RPC comercial ni a MP.
Evidencia: [ADMIN_COMERCIAL_MIGRACION_PRODUCCION.md](../ADMIN_COMERCIAL_MIGRACION_PRODUCCION.md).

Pendientes: desplegar backend/frontend con switch comercial apagado, QA autenticado real y
habilitación controlada según [el runbook](../ADMIN_COMERCIAL_ACTIVACION.md).
La excepción recibida cubre solo esta migración; no autoriza otras migraciones ni
habilitación comercial. Suspensión requiere auditoría y build posterior de
enforcement servidor; cualquier cambio `SECURITY DEFINER` necesita autorización
específica antes de aplicar.

## Próximas fases posibles

Después de activar la gestión comercial, suspensión efectiva y salud de
webhooks/cron, conciliación de Mercado Pago,
alertas y exportes. Administradores nominales con MFA deben preceder una expansión
significativa de permisos. La impersonación requiere una iniciativa separada con
modelo explícito de privacidad, consentimiento y auditoría.
