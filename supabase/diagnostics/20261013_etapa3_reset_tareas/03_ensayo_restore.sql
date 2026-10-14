-- Etapa 3 · BUILD 3 · Paso 3 — Ensayo de restauración. NO deja cambios.
-- Dentro de un sub-bloque que siempre se revierte: borra el alcance, restaura desde etapa3_backup
-- (triggers de usuario de tareas/tareas_recurrentes desactivados solo durante el INSERT) y compara ids y
-- checksums con el backup. La transacción además termina en ROLLBACK.
-- Resultado esperado: {"ensayo": "ok", ...}. Cualquier otra cosa es un error y detiene el proceso.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT etapa3_backup.ensayo_restore() AS resultado;
ROLLBACK;
