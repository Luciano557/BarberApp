# Tareas y Tareas automáticas

Estado: **Etapa 2 (motor de Tareas automáticas) implementada, aplicada en el proyecto Supabase
operativo y verificada — 2026-10-12.** **Etapa 3 (backup, reset pre-lanzamiento e integridad definitiva) ejecutada
y verificada — 2026-10-13**: las Tareas legacy se borraron con un backup interno verificado (ver “Reset
pre-lanzamiento” al final). Falta el QA manual de Sebastián (ver `ESTADO_ACTUAL.md`).
**No** incluye el rediseño de la pantalla (Etapa 4).

- **Ubicación en la app:** barra lateral → Principal → Tareas (`src/components/TareasPanel.tsx`).
  Pestañas Tareas / Peticiones; el botón **Tareas automáticas** abre su panel dentro de Tareas.
- **Archivos técnicos:** `src/components/tareas/RecurrentesPanel.tsx`, `RecurrenteCard.tsx`,
  `TareaRecurrenteFormDialog.tsx`, `TareaFormDialog.tsx`, `RepeatPicker.tsx`, `CustomRepeatSheet.tsx`,
  `TareasAutomaticasPausaAviso.tsx`; hooks `src/hooks/useTareas.ts`, `useTareasRecurrentes.ts`;
  utilidades `src/lib/tareasAutomaticas.ts`, `src/lib/tareasVencimiento.ts`.
- **Terminología:** al usuario se le dice **Tareas automáticas** (no “recurrencias”). Los nombres
  técnicos históricos se mantienen: tabla `tareas_recurrentes`, `RecurrentesPanel.tsx`,
  `useTareasRecurrentes.ts`.

## Modelo: Tarea automática → tareas generadas

| Pieza | Qué es |
|---|---|
| `tareas_recurrentes` | La **Tarea automática** (la “receta”): título, descripción, a quién (`individual` con `asignado_a` = `barberos.id`, o `team`), sucursal (obligatoria), hora, **programación** y `proxima_fecha`. Es la única dueña de la programación. |
| `tareas` | Cada **tarea generada** (ocurrencia). `tipo='tarea'`, `recurrente=false`, sin `repeat_*`, `creado_por_id` NULL y “Sistema”, `recurrencia_id` apunta a la Tarea automática. La etiqueta **Automática** de la pantalla sale de `recurrencia_id`. |
| `uq_tareas_recurrencia_fecha` | Índice único `(recurrencia_id, fecha_inicio)`: clave de idempotencia (una ocurrencia por Tarea automática y fecha). |

Crear una tarea con repetición desde **Nueva tarea** crea **solo la Tarea automática**; el servidor
genera la tarea de hoy si corresponde (antes el cliente creaba esa primera tarea con la fecha UTC y
podía desplazar el ciclo). Al **editar** una tarea no hay repetición: si viene de una Tarea automática,
el formulario indica editarla en Tareas → Tareas automáticas.

## Calendario canónico (única fuente: la base)

La serie de fechas se calcula **siempre desde `fecha_inicio`** (nunca “fecha anterior + intervalo”, que
acumula drift). Convención de días: 0 = domingo … 6 = sábado; las semanas empiezan el lunes.

| Preset | Regla |
|---|---|
| `daily` | cada día |
| `weekdays` / `weekends` | lunes a viernes / sábado y domingo |
| `weekly` / `biweekly` | cada 1 / 2 semanas, el día de la semana de `fecha_inicio` |
| `monthly` / `quarterly` / `semiannual` / `yearly` | cada 1 / 3 / 6 / 12 meses; si el mes no tiene ese día, el último día del mes (29/30/31, febrero, bisiesto; 29-feb anual → 28-feb en años no bisiestos) |
| `custom` | diario / semanal (con días elegidos) / mensual / anual, cada N (1–99). Semanal sin días elige el día de `fecha_inicio`; cada N semanas cuenta desde la semana del ancla |

Funciones (`SECURITY INVOKER`, `search_path=''`, **sin `EXECUTE` para ningún rol de cliente**):
`_tareas_auto_regla`, `_tareas_auto_siguiente` (primera fecha estrictamente posterior a una dada),
`_tareas_auto_vigente` (última fecha ≤ una dada), `_tareas_auto_hoy`, `_tareas_auto_lunes`,
`_tareas_auto_en_semana`, `_tareas_auto_tz_valida`. `calcNextDate` (`src/lib/recurrence.ts`) **no se
tocó**: lo usan los Gastos recurrentes. La función SQL anterior `_calc_next_tarea_date` se eliminó
(trataba weekly/biweekly/quarterly/semiannual/yearly como “+1 día”).

## Zona horaria

“Hoy” es `(ahora AT TIME ZONE organizations.timezone)::date`; sin zona válida usa
`America/Argentina/Buenos_Aires` y el motor deja un `WARNING`. No se usa la zona del navegador, la de la
sucursal ni `CURRENT_DATE`. La validación de zona horaria de la Etapa 1 se conserva.

## Motor y cron

- `process_tareas_recurrentes()` (cron horario `0 * * * *`, mismo nombre, firma y permisos: solo
  `service_role`) delega en `_tareas_auto_procesar(_now)`; `_now` permite probarlo con un instante fijo.
- Cada ejecución: (1) sincroniza pausas; (2) para cada Tarea automática activa con `proxima_fecha ≤ hoy` genera
  **como máximo una** ocurrencia, la **vigente** (última fecha de la serie ≤ hoy y ≥ `proxima_fecha`), y
  deja `proxima_fecha` en la primera fecha **posterior a hoy**.
- Idempotencia y concurrencia: `FOR UPDATE SKIP LOCKED` + `INSERT … ON CONFLICT (recurrencia_id, fecha_inicio) DO NOTHING`.
  Un reintento o una ejecución en paralelo no duplican.
- Aislamiento de errores: cada organización y cada Tarea automática corren en su propio sub-bloque; el
  `WARNING` lleva solo identificadores. Una Tarea automática defectuosa no frena a las demás.
- Antes de generar valida sucursal y persona (asignación vigente); si no, **pausa y no genera**.
- Al **guardar** (alta, cambio de programación, reanudar) el trigger `trg_tareas_recurrentes_generar`
  genera la tarea de hoy si corresponde; nunca bloquea el guardado (si falla, el cron reintenta).

### Recuperación excepcional (solo ante un fallo técnico del motor)

Si el motor estuvo detenido: **no reconstruye** lo perdido; genera como máximo la ocurrencia vigente. Si esa
ocurrencia **ya habría nacido vencida** (`fecha + tareas_vencimiento_dias_default < hoy`) **no se crea**, no
se avisa nada y se avanza a la próxima fecha futura. Trazabilidad en la propia Tarea automática:
`recuperaciones` (contador acumulado), `recuperacion_tipo` (`omitida` | `tardia`), `recuperacion_fecha`
(primera fecha perdida), `recuperacion_at`. **Un contador que crece indica que el motor está fallando**;
la recuperación no se vuelve comportamiento normal.

```sql
-- ¿Hubo recuperaciones excepcionales? (solo lectura)
select id, recuperaciones, recuperacion_tipo, recuperacion_fecha, recuperacion_at
from public.tareas_recurrentes where recuperaciones > 0 order by recuperacion_at desc;
```

## Pausas

`activo` es “¿genera?”; `pausa_motivo` dice por qué no (`activo = (pausa_motivo IS NULL)`):

| Motivo | Quién lo pone | Se reanuda sola |
|---|---|---|
| `manual` | una persona (Pausar) | **No**, nunca |
| `sucursal_inactiva` | sucursal desactivada (`activa=false` o `deleted_at`) | Sí, al reactivarla |
| `barbero_inactivo` | `barberos.activo=false`, persona borrada | Sí, al reactivarla |
| `barbero_sin_asignacion` | el barbero ya no tiene **ninguna asignación vigente** a la sucursal (ver abajo) | Sí, al volver a tener una |

- Los triggers sobre `barberos`, `sucursales` y `barberos_sucursales` pausan **y** reanudan; el motor repite la
  sincronización cada hora como red de seguridad. Si hay varias causas, manda la más fuerte
  (sucursal > persona inactiva > sin asignación). Una pausa automática **nunca** pisa una manual.
- Al reanudar, `proxima_fecha` se recalcula desde hoy; **no se genera lo atrasado**.
- Reanudar a mano con el recurso inactivo se rechaza con un mensaje claro; la tarjeta no ofrece “Reanudar” para
  una pausa automática y muestra el motivo.
- **Aviso al usuario:** `tarea_automatica_pausada` (a dueño, encargado general y encargados de la sucursal)
  solo para `sucursal_inactiva` y `barbero_inactivo`. `barbero_sin_asignacion` **no** genera aviso en la campana: el aviso
  es previo, dentro de la acción que la provoca.
- **Antes de confirmar** una acción que realmente pausará Tareas automáticas se muestra cuántas se pausarán (solo si hay):
  *Finalizar actividad* de un barbero (`EquipoUnificado.tsx`), *Desactivar sucursal* (`SucursalTabContent.tsx`),
  *Eliminar asignación* en `EquipoSucursalPanel.tsx` y, en `BarberSucursalesGeneralSection.tsx`, *Eliminar asignación recurrente*
  y *Cambiar sucursal principal* — estas tres últimas **solo si era la última asignación vigente** del barbero en esa
  sucursal. *Desactivar de la sucursal* (`disponible=false`) **no** avisa porque no pausa nada. Mismo recuadro de
  advertencia que ya usaban los diálogos para turnos futuros; si no se puede consultar, el aviso lo dice.

### Pertenencia estructural (E2-M5) vs. disponibilidad diaria

`barberos_sucursales.disponible` es **disponibilidad operativa**: dónde está el barbero *hoy*. Lo recalcula solo el cron
`bs-recompute-disponibles-daily` y solo una fila por barbero puede estar disponible. **No participa** en pausar ni reanudar
Tareas automáticas. Lo que decide es la **pertenencia estructural**: existe alguna asignación vigente del par
(organización, barbero, sucursal):

| Tipo de fila | Cuenta como pertenencia |
|---|---|
| `principal` | mientras exista la fila |
| `recurrente` | mientras exista la fila (no depende de que hoy sea uno de sus `dias_semana`) |
| `temporal` | solo entre `fecha_inicio` (vacío = ya empezó) y `fecha_fin`, según el “hoy” de la organización. Futura: todavía no. Vencida: ya no, aunque la fila histórica siga existiendo (no se borra) |

Triggers de `barberos_sucursales`: alta, baja y cambios de `organization_id, barbero_id, sucursal_id, tipo, fecha_inicio,
fecha_fin` (mover la principal sincroniza la sucursal que se deja y la nueva). Una temporal que empieza o vence **sin que
nadie edite nada** la resuelve la sincronización horaria del motor: puede demorar hasta una hora. Un barbero que trabaja
en dos sucursales ya no pausa ni reanuda nada por la rotación diaria.

## Edición

`proxima_fecha` la fija **solo la base** y se recalcula únicamente si cambia la programación (inicio,
repetición, intervalo, días) o al reanudar. Editar título, descripción, hora o asignación **no** la mueve; reenviar la
misma programación tampoco (se compara la regla normalizada). Un cliente no puede escribir `proxima_fecha`,
`pausa_motivo`, `pausada_at` ni `recuperacion_*`. La organización de una Tarea automática no cambia, y su
sucursal y persona deben ser de **la misma organización** (cierra el hueco que dejaba la clave foránea sola).

## Vencimientos

`process_vencimientos_tareas()` (cron horario): `pendiente` vencida → `estado='vencida'` + `vencida_at`;
**`en_progreso` vencida → conserva `estado='en_progreso'` y recibe `vencida_at`** (“empezada” y “atrasada” son
independientes; la tarjeta muestra **En progreso** y **Vencida** a la vez, y los filtros la incluyen en “Vencida”). Aviso
`tarea_vencida` una sola vez. Aislamiento por fila. Plazo: `fecha_inicio + organizations.tareas_vencimiento_dias_default`
en el día de la organización.

## Identidad y notificaciones

`profiles.barbero_id → barberos.id`; `profiles.id = auth.users.id`. Un barbero puede tener 0..n usuarios. El
helper `_notif_barbero_users(org, barbero_id)` devuelve esos usuarios (exige que el barbero sea de la organización).
`tareas.asignado_a_id` y `tareas_recurrentes.asignado_a` son **barberos**; **nunca** se usan como id de usuario
(corregido en `trg_tareas_after_insert_notif`, `process_vencimientos_tareas` y
`trg_barberos_sucursales_after_disponible_off_notif`). Detalle de eventos: `docs/MODULOS/notificaciones.md`.

## Seguridad

| Función | Tipo | Quién la ejecuta |
|---|---|---|
| `_tareas_auto_*` (calendario, motivo, reconciliar, generar, procesar), `_notif_barbero_users` | `SECURITY INVOKER`, `search_path=''` | Nadie desde un cliente (`anon`, `authenticated`, `service_role` sin `EXECUTE`) |
| `process_tareas_recurrentes()`, `process_vencimientos_tareas()` | `SECURITY DEFINER`, `search_path=''` | Solo `service_role` y el dueño (cron) |
| `trg_tareas_recurrentes_prepare`, `trg_tareas_recurrentes_generar`, `trg_tareas_auto_sync_*` (barberos / sucursales / barberos_sucursales) | `SECURITY DEFINER`, `search_path=''`, filtran por `organization_id` | Solo como trigger; sin `EXECUTE` para clientes |
| ~~`trg_tareas_tipo_guard`~~ | — | **Eliminado** el 2026-10-13 (3B): lo reemplaza `tareas_tipo_check` |

El trigger de preparación distingue una escritura de cliente (`auth.uid()` presente y sin la marca interna
`vittro.tareas_auto`) de las internas (motor, sincronización, cron, `service_role`). Las funciones DEFINER son
necesarias porque quien desactiva a una persona o sucursal puede no tener `UPDATE` sobre las Tareas automáticas
ni acceso a los helpers de notificaciones cerrados en la Etapa 1.

## Integridad

CHECKs en `tareas_recurrentes` (validados): preset permitido, custom con frecuencia válida, intervalo 1–99, días
0–6 solo en custom semanal, `pausa_motivo` y `recuperacion_tipo` en su conjunto, `activo ⇔ sin motivo`.
`tareas.estado` queda limitado a `pendiente, en_progreso, completada, vencida, rechazada, aprobada` (CHECK validado).
`tareas.tipo` solo admite `tarea` y `peticion`: CHECK `tareas_tipo_check` **validado** (3B, 2026-10-13). `admin` dejó de
ser un valor válido; el trigger temporal `trg_tareas_tipo_guard` (E2-M4) y su función se eliminaron porque el CHECK lo
reemplaza por completo (era un trigger y no un CHECK solo porque existían 141 filas `admin` históricas que el `UPDATE` de la
clave foránea `ON DELETE SET NULL` habría hecho rechazar). Además `tareas_recurrencia_check` (validado): una ocurrencia
de Tarea automática (`recurrencia_id` no nulo) es siempre `tipo='tarea'` y tiene `fecha_inicio`, de modo que
`uq_tareas_recurrencia_fecha` las cubre a todas; el `ON DELETE SET NULL` de la receta sigue funcionando.

## Migraciones (aplicadas 2026-10-12 en el proyecto operativo)

`20261012120000_tareas_automaticas_calendario.sql`, `…120100_tareas_automaticas_pausa_integridad.sql`,
`…120200_tareas_automaticas_motor.sql`, `…120300_tareas_tipo_estado_integridad.sql` y la corrección
`…120400_tareas_automaticas_pertenencia_estructural.sql` (E2-M5). En Supabase quedaron registradas con el mismo nombre
y la versión que asignó el conector (`20261012190213`, `…190408`, `…190548`, `…190623`, `20261012220833`).
Cada una trae su preflight (aborta si falta la Etapa 1, hay dueños distintos, un job de cron perdería acceso o una
Tarea automática apunta a otra organización) y verifica sus permisos al final.

Etapa 3 (2026-10-13): `20261013120000_tareas_integridad_post_reset.sql` (3B; remota `20261013234522`,
`tareas_integridad_post_reset`). Su preflight aborta, sin tocar nada, si queda alguna fila con un tipo fuera de
`tarea`/`peticion` o una ocurrencia automática inválida; no modifica datos, RLS, grants, crons ni el motor. El reset en sí **no es una
migración**: es una operación única con scripts en `supabase/diagnostics/20261013_etapa3_reset_tareas/`.

## Pruebas

```bash
npm install --prefix node_modules/.admin-sql-test --no-package-lock --no-save @electric-sql/pglite@0.5.8
node supabase/tests/tareas-automaticas-sql.mjs                    # 82 pruebas SQL (72 de la Etapa 2 + 10 de la Etapa 3)
node supabase/tests/tareas-automaticas-sql.mjs --mutation-check   # 24 mutaciones, todas detectadas
node supabase/tests/notifications-security-sql.mjs                # Etapa 1: 44 pruebas, siguen pasando
bunx vitest run src/lib/tareasAutomaticas.test.ts src/components/tareas
```

`tareas-automaticas-sql.mjs` reconstruye la forma real de producción (migraciones históricas + Etapa 1), prueba los
defectos previos y aplica las cuatro migraciones nuevas. Cubre calendario (semanal, cada N, varios días, mensual
29/30/31, febrero, bisiesto, 29-feb, sin drift), zona horaria (Buenos Aires vs Madrid, medianoche, respaldo),
generación (`tipo='tarea'`, nunca `admin`, idempotencia, reintento, generación al guardar), recuperación
(`omitida`/`tardia`, sin aviso retroactivo, contador), recursos (sucursal, persona, pertenencia estructural: principal/recurrente/temporal, rotación de disponibilidad, manual vs
automática, prioridades, red de seguridad), edición, vencimientos (incluye `en_progreso`), destinatarios (usuarios
del barbero, nunca `barberos.id`), aislamiento entre organizaciones, aislamiento de errores, permisos y
`SECURITY DEFINER`, y los controles de las propias migraciones. Un hecho que las pruebas **no** cubren: la
concurrencia real entre dos sesiones (PGlite tiene una sola conexión); `FOR UPDATE SKIP LOCKED` se verifica en
el código entregado.

## Reset pre-lanzamiento (Etapa 3) — ejecutado 2026-10-13

Decisión de producto: antes del lanzamiento se descartó el historial de Tareas generado por el motor anterior (141
tareas `tipo='admin'` invisibles para los barberos y Tareas automáticas con `proxima_fecha` fuera de calendario), en vez
de sanearlo fila por fila. No es una migración: es una operación única, con scripts reproducibles y verificables en
`supabase/diagnostics/20261013_etapa3_reset_tareas/` (ver su `README.md`).

- **Alcance borrado** (calculado en el momento, no con cifras fijas): las tareas con `tipo IN ('admin','tarea')`, **todas**
  las Tareas automáticas y las notificaciones de Tareas identificadas solo por columnas estructurales
  (`source_module='tareas'` + `source_table` + evento + `source_id`; incluidas las huérfanas). Sus entregas y lecturas
  cayeron por `ON DELETE CASCADE`. Cantidades reales: 144 tareas (141 `admin` + 3 `tarea`), 5 Tareas automáticas
  (todas activas), 11 notificaciones (8 huérfanas), 18 entregas y 1 lectura.
- **Intacto:** las peticiones (`tipo='peticion'`, hoy no hay ninguna) y las notificaciones `peticion_*`; 3.099
  notificaciones y 2.918 entregas de otros módulos; organizaciones, barberos, sucursales y `barberos_sucursales` (mismas
  cantidades, ids y último `updated_at`); funciones, triggers, grants, RLS y crons de las Etapas 1 y 2.
- **Cómo:** (1) schema `etapa3_backup` fuera de `public`, sin acceso para `anon`, `authenticated` ni `service_role`
  (solo el dueño), con copias completas, `manifest` (cantidades, md5 de filas completas, md5 de ids) e ids de control;
  (2) 27 verificaciones, backup = vivo en ambos sentidos; (3) ensayo de restauración dentro de un bloque que siempre se
  revierte (R → T → N → entregas → lecturas, mismos ids y checksums, triggers de usuario deshabilitados solo durante el
  `INSERT` y vueltos a habilitar; sin `session_replication_role`); (4) reset en una sola transacción bajo `LOCK`, que
  recalcula el alcance, lo compara con el backup, borra en orden notificaciones → tareas → Tareas automáticas y comprueba
  20 post-condiciones antes del `COMMIT`; (5) segunda ejecución: `{"ya_aplicado": true, "borradas": 0}`.
- **Copia de seguridad:** la única es el schema `etapa3_backup` **dentro del mismo proyecto Supabase** (no hay una copia
  fuera de la base). Contiene datos reales de las organizaciones y sigue ahí; qué se hace con él (conservarlo o eliminarlo
  con `DROP SCHEMA etapa3_backup CASCADE`) es una decisión pendiente de Sebastián. Restaurar:
  `06_restaurar_SOLO_SI_SE_DECIDE.sql`; tras 3B las filas `admin` no pueden volver sin quitar antes `tareas_tipo_check`.
- **Lo que se ve:** la lista de Tareas quedó vacía y las 5 Tareas automáticas **hay que volver a crearlas**: no se
  restauran solas, y el motor no genera nada hasta entonces.

## Deuda (no es esta etapa)

- `deleteReceta` (`useTareasRecurrentes.ts`) calcula “hoy” con la fecha del navegador para borrar las tareas
  futuras pendientes; `useTareas` lee sin paginar (tope de 1000 filas de PostgREST); rediseño de la pantalla: Etapa 4.
- No hay vista previa de próximas fechas ni equivalente TypeScript del calendario: la base es la única fuente.
