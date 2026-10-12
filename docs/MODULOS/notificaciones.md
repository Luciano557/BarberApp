# Notificaciones

Estado: **Etapa 1 de seguridad implementada y validada localmente — 2026-10-12.**
Las tres migraciones están en el repositorio y pasan 44 pruebas SQL sobre
PostgreSQL local sintético (PGlite). **No se aplicaron a ningún proyecto Supabase
desde este build**; aplicarlas, regenerar tipos y hacer el QA autenticado son
pasos pendientes (ver “Pendiente”).

- **Ubicación en la app:** barra lateral → campana de Notificaciones → No leídas / Leídas.
- **Archivos técnicos:** `src/components/notifications/NotificationsBell.tsx`,
  `src/hooks/useNotifications.ts`, `src/hooks/useNotificationPreferences.ts`,
  `src/lib/notifications/catalog.ts`.
- **Configuración de preferencias:** `src/components/config/NotificationsConfig.tsx`.

## Modelo: evento y entrega

| Tabla | Qué representa | Quién escribe | Quién lee |
|---|---|---|---|
| `notifications` | El **evento**: título, cuerpo, `metadata` (montos, nombres), `sucursal_id`, `category`. Única por `(organization_id, event_key)`. | Solo las funciones `SECURITY DEFINER` que emiten (triggers, cron, `notif_emit_view_event`). | Solo quien tiene una **entrega propia** de ese evento. |
| `notification_deliveries` | Una fila por **destinatario**: `user_id`, `read_at`, `hidden_at`. | Solo las mismas funciones. El cliente únicamente cambia `read_at` y `hidden_at` de su propia fila. | Cada usuario ve solo las suyas. |
| `user_notification_preferences` | Preferencia por tipo de evento (`enabled`, `mode`). | El propio usuario. | El propio usuario. |
| `notification_reads` | Legado de lectura por `(source_type, source_id)`. | El propio usuario. | El propio usuario. |

**Fuente de verdad: `notification_deliveries`.** Los destinatarios se calculan **al
momento de emitir**, según cargo, sucursal y preferencia del usuario en ese
instante. Leer un evento exige una entrega propia en la misma organización. No
existe el concepto de “notificación visible para toda la organización”: un aviso
institucional se reparte con una entrega a cada admin/manager correspondiente.
Un mismo hecho con públicos distintos se emite como eventos distintos (ej. turnos:
`:propio`, `:companero`, `:gestion`).

### Historial (decisión D1)

La entrega histórica **sigue siendo válida** aunque la persona pierda después el
cargo o la sucursal: conserva lo que recibió legítimamente y no recibe avisos
nuevos que ya no le correspondan (las emisiones usan los permisos vigentes al
momento del evento). No hay revocación retroactiva. Si deja de pertenecer a la
organización, el control por organización le corta el acceso a sus avisos.

## Autorización por capa

1. **Privilegios de tabla.** `anon` no tiene privilegios sobre las cuatro tablas.
   `authenticated`: `SELECT` en `notifications`; `SELECT` y `UPDATE` en
   `notification_deliveries`. Sin `INSERT`, `UPDATE`, `DELETE` ni `TRUNCATE` donde no corresponde.
2. **RLS.** `notifications`: una sola política `SELECT … TO authenticated` que exige
   organización del usuario **y** una entrega propia para esa notificación
   (`EXISTS` sobre el índice único `(notification_id, user_id)`; sin recursión).
   `notification_deliveries`: filas propias de la organización del usuario.
3. **Inmutabilidad de entregas.** Trigger `SECURITY INVOKER`
   (`notification_deliveries_guard_immutable`) que rechaza cambios en `id`,
   `notification_id`, `organization_id`, `user_id` y `created_at`. Se eligió trigger y
   no privilegios por columna porque Supabase los documenta como una función
   avanzada que rompe los `select *`.
4. **Funciones.** Ver la tabla siguiente. Los helpers internos no son llamables
   desde ningún rol de cliente; los triggers y el cron siguen funcionando porque las
   funciones `SECURITY DEFINER` se ejecutan con los permisos del dueño.
5. **Zona horaria.** Trigger `SECURITY INVOKER` que rechaza valores que no sean
   nombres IANA (o `NULL`) al insertar/actualizar `organizations.timezone`.

### Actores (resultado verificado por las pruebas)

| Evento | Owner / GM | Manager de la sucursal | Manager de otra sucursal | Barbero | Cuenta de sucursal | Otro rol / sin organización | Otra organización |
|---|---|---|---|---|---|---|---|
| Pago de sueldo, inversión, deuda, cambio de cargo, configuración crítica | Sí | No | No | No | No | No | No |
| Gasto, cierre/anulación de caja, transacción anulada, cambio de acceso | Sí | Sí | No | No | No | No | No |
| Tarea de equipo / vencida | Sí | Sí | No | Sí (de esa sucursal) | Sí (esa sucursal) | No | No |
| Turno propio | — | — | — | Sí (el asignado) | — | No | No |

## Productores

Todos son `SECURITY DEFINER`, crean el evento y sus entregas, y dependen de los helpers `_notif_*`.

| Ubicación funcional | Función / migración | Eventos |
|---|---|---|
| Tareas → crear tarea o petición | `trg_tareas_after_insert_notif` (`20260515220322`) | `tarea_asignada`, `tarea_equipo_asignada`, `peticion_nueva` |
| Tareas → aprobar / rechazar petición | `trg_tareas_after_update_notif` (`20260515220322`) | `peticion_aprobada`, `peticion_rechazada` |
| Tareas (cron horario) | `process_vencimientos_tareas()` (`20260602052143`) | `tarea_vencida`, `peticion_vencida` |
| Turnos → crear, reprogramar, cancelar | `trg_turnos_after_*_notif` → `_notif_turno_dispatch` (`20260515220322`) | `turno_*` (propio / compañero / gestión) |
| Caja → cierre, anulación de cierre, transacción anulada | `trg_ingresos_*`, `trg_anulaciones_cierre_*`, `trg_venta_*` (`20260515222233`) | `cierre_caja_*`, `anulacion_cierre`, `transaccion_anulada` |
| Finanzas → Gastos | `trg_egresos_after_*_notif` (`20260515222233`) | `gasto_registrado`, `gasto_editado`, `gasto_anulado` |
| Finanzas → Sueldos / Inversiones / Deudas | `trg_pagos_sueldos_*`, `trg_inversiones_*`, `trg_deudas_*` (`20260515222233`) | `pago_sueldo_registrado`, `inversion_creada`, `deuda_creada` |
| Configuración → cargos, accesos, PIN | `trg_user_roles_*`, `trg_user_sucursales_*`, `trg_pin_config_*` (`20260515222233`) | `cambio_roles`, `cambio_permisos`, `cambio_configuracion_critica` |
| Equipo → barbero deshabilitado en sucursal | `trg_barberos_sucursales_after_disponible_off_notif` (`20260608120225`) | `barbero_removido_sucursal` |
| Finanzas → Gastos / Sueldos (cuenta de sucursal desbloquea la vista) | RPC `notif_emit_view_event` (`GastosPanel.tsx`, `SueldosPanel.tsx`) | `visualizacion_gastos`, `visualizacion_sueldos` |

## Permisos de funciones

| Función | `EXECUTE` | Nota |
|---|---|---|
| `_notif_emit`, `_notif_emit_sensitive`, `_notif_org_admins`, `_notif_sucursal_managers`, `_notif_sucursal_barbers`, `_notif_sucursal_account`, `_notif_actor_name`, `_notif_actor_account_type`, `_notif_pref_mode`, `_notif_turno_dispatch`, `_notif_turno_metadata`, `_notif_turno_title` | Nadie salvo el dueño (revocado a `PUBLIC`, `anon`, `authenticated`, `service_role`) | Llamables solo desde otras funciones `SECURITY DEFINER` del mismo dueño |
| `notif_emit_view_event(text, uuid)` | `authenticated` | `SECURITY DEFINER`, `search_path = ''`. Valida usuario, organización, rol de cuenta de sucursal y que `_sucursal_id` sea la de **esa** cuenta. |
| `notif_emit_login_sucursal_account`, `notif_emit_action_blocked`, `notif_emit_pin_authorized` | Nadie salvo el dueño (revocado a `PUBLIC`, `anon`, `authenticated` y `service_role`) | Nada las invoca todavía; se conservan para su futura implementación |
| `process_vencimientos_tareas()` | Dueño (cron) y `service_role` | Sin exposición a clientes |
| `upsert_notification`, `upsert_notification_delivery` | — | **Eliminadas.** Permitían fabricar/sobrescribir avisos y autosuscribirse |

## Cómo agregar una notificación nueva

1. Emitir **siempre desde el servidor**: un trigger o función `SECURITY DEFINER`
   (dueño de las tablas) que calcule los destinatarios con los helpers y llame a
   `_notif_emit` o `_notif_emit_sensitive`. Nunca insertar en `notifications` desde el cliente.
2. Cada persona que deba verla necesita **su entrega**. Si no hay entrega, no hay lectura.
3. Si una acción del cliente debe disparar un aviso, usar una RPC `SECURITY DEFINER` como
   `notif_emit_view_event`: validar `auth.uid()`, la organización y la **pertenencia de cada
   id recibido**, con `search_path` fijo y nombres calificados.
4. **Revocar `EXECUTE` en la misma migración** que crea la función: Supabase concede por
   defecto a `anon`, `authenticated` y `service_role`. No usar `ALTER DEFAULT PRIVILEGES`
   global sobre `public` (rompería funciones legítimas). La prueba de catálogo H.6
   falla si una función `_notif*`, `notif_*` o `upsert_notification*` queda ejecutable por
   un cliente sin estar en la lista permitida.
5. Registrar el evento en `src/lib/notifications/catalog.ts` (`rolesAllowed` es solo un
   filtro de presentación, no una barrera de seguridad).
6. Sumar un escenario a `supabase/tests/notifications-security-sql.mjs`.

## Pruebas

```bash
npm install --prefix node_modules/.admin-sql-test --no-package-lock --no-save @electric-sql/pglite@0.5.8
node supabase/tests/notifications-security-sql.mjs
```

`supabase/tests/notifications-security-sql.mjs` carga las migraciones históricas reales sobre
PostgreSQL local con un dueño **no superusuario** (para que los permisos sean reales) y los
privilegios por defecto de Supabase emulados. Primero demuestra las vulnerabilidades del
estado previo (SEG-01 a SEG-06), luego aplica M1–M3 y comprueba que quedaron cerradas, que
los 22 escenarios de productores emiten exactamente las mismas entregas y que las
migraciones abortan ante dueños distintos, llamadores `SECURITY INVOKER` desconocidos,
trabajos de pg_cron que perderían acceso o políticas inesperadas. Datos 100 % sintéticos,
sin URLs ni credenciales. Se verificó además por mutación que las pruebas fallan si se
debilita cada migración.

## Pendiente y límites

- **Aplicar M1–M3 en Supabase** por el canal que se decida. Un `push` de Git no las aplica.
  Antes de M1: confirmar en la base destino que todas las funciones
  tienen el mismo dueño y que los jobs de `cron.job` corren como ese dueño (M1 lo
  comprueba y aborta si no).
- **Tipos generados:** se retiraron a mano las dos RPC eliminadas de
  `src/integrations/supabase/types.ts` porque no hay base disponible para
  `supabase gen types`. Regenerarlos al aplicar las migraciones.
- **QA manual autenticado** de la campana con usuarios sintéticos de dos organizaciones.
- Fuera de esta etapa: RLS de Finanzas (los managers leen todos los `Egresos` de la
  organización); helpers generales de RLS (`has_role`, `get_user_organization_id`… aceptan un
  `user_id` arbitrario); aislar fallos por organización dentro de los cron y limpiar
  zonas horarias históricas (Etapa 2); recurrencias, `tipo='admin'` y semántica de fechas;
  push (`send-push-notification` solo acepta la clave `service_role`); el bug legado de
  lecturas que reaparecen (`notification_reads`); las funciones `trg_*` siguen siendo
  `SECURITY DEFINER` con `EXECUTE` por defecto (no son invocables como RPC); tres eventos del
  catálogo figuran `implemented: true` y nada los emite todavía.
