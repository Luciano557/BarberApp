# Etapa 3 — Reset controlado pre-lanzamiento de Tareas

Operación única sobre `azqpyfoobpovqosbayvz` (el único Supabase). **No es una migración.**
La migración de integridad posterior es `supabase/migrations/20261013120000_tareas_integridad_post_reset.sql` (3B)
y se aplica **solo después** del reset verificado (aborta sola si quedan filas `admin`).

## Alcance (una sola definición: `etapa3_backup.sel_*`)

| Tabla | Se borra | Nunca |
|---|---|---|
| `tareas` | `tipo IN ('admin','tarea')` | `tipo = 'peticion'` |
| `tareas_recurrentes` | todas | — |
| `notifications` | `source_module='tareas'` y `source_id` no nulo, con `source_table='tareas'` + `tarea_pendiente/asignada/equipo_asignada/vencida`, o `source_table='tareas_recurrentes'` + `tarea_automatica_pausada`. Incluye huérfanas. | `peticion_*`, otros módulos, texto/metadata, un origen que sea una petición o de otra organización |
| `notification_deliveries`, `notification_reads` | las de esas notificaciones (caen por `ON DELETE CASCADE`) | el resto |

Cualquier cosa que no se pueda clasificar (evento nuevo bajo `source_module='tareas'`, tipo de tarea desconocido,
FK nueva, trigger de DELETE, cruce de organización) **detiene** el proceso: `etapa3_backup.ambiguedades()`.

## Orden (no saltear pasos)

1. `01_backup.sql` — crea `etapa3_backup` (fuera de `public`, sin acceso para `anon`/`authenticated`/`service_role`),
   copia filas completas, `manifest` + `manifest_ids` y las funciones. Aborta si el schema ya existe.
2. `02_verificar_backup.sql` — solo lectura; todas las filas `ok = true`.
3. `03_ensayo_restore.sql` — borra y restaura dentro de un sub-bloque que siempre se revierte; espera `{"ensayo":"ok"}`.
4. Copia externa del schema: **opcional** (decisión de Sebastián, 2026-10-13; ver abajo). El respaldo obligatorio es el
   backup interno verificado (pasos 1 a 3).
5. `04_reset.sql` — lejos del minuto 00. Bloquea, revalida contra el backup, borra, comprueba y confirma.
   Si algo cambió desde el backup: aborta sin borrar → descartar el backup (`DROP SCHEMA etapa3_backup CASCADE`,
   solo si el reset no se ejecutó) y volver al paso 1.
6. `05_postcondiciones.sql` — solo lectura; todas `ok = true`. Correr `04_reset.sql` otra vez debe devolver
   `{"ya_aplicado": true, "borradas": 0}`.
7. Migración 3B; después, `05_postcondiciones.sql` otra vez.

`06_restaurar_SOLO_SI_SE_DECIDE.sql` vuelve atrás desde el backup (antes de 3B; después hay que quitar su CHECK).

## Estado

Ejecutado en `azqpyfoobpovqosbayvz` el 2026-10-13 (pasos 1, 2, 3, 4 —reset—, 5 y migración 3B), **sin copia externa**: el
usuario aceptó continuar con el backup interno verificado. El único respaldo es el schema `etapa3_backup` del mismo proyecto
(contiene datos reales; nunca copiarlo al repositorio). Segunda ejecución de `04_reset.sql`: `{"ya_aplicado": true, "borradas": 0}`.

## Copia externa (paso 4, opcional; no realizada)

Si más adelante se quiere una copia fuera de la base, requiere `pg_dump`/`pg_restore` **versión 17 o superior** (el servidor es PostgreSQL 17.6) y la conexión
*Session pooler* del proyecto (Dashboard → Connect). La contraseña se escribe cuando `pg_dump` la pide; no se guarda
en archivos ni en el repo.

```powershell
New-Item -ItemType Directory -Force "$HOME\Vittro-backups"
pg_dump "<cadena Session pooler SIN contraseña>" --schema=etapa3_backup --format=custom --file "$HOME\Vittro-backups\etapa3_backup_<fecha>.dump"
pg_restore --list "$HOME\Vittro-backups\etapa3_backup_<fecha>.dump"
```

Verificar: el archivo existe, pesa más de 0 bytes y `pg_restore --list` muestra las 7 tablas de `etapa3_backup`
(`tareas_recurrentes`, `tareas`, `notifications`, `notification_deliveries`, `notification_reads`, `manifest`,
`manifest_ids`) con sus `TABLE DATA`. **El dump contiene datos reales: nunca dentro del repositorio ni en GitHub.**
