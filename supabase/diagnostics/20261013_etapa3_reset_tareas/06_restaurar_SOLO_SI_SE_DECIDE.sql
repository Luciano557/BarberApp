-- Etapa 3 — Restauración REAL desde etapa3_backup. NO forma parte del reset.
-- Ejecutar solo si se decide volver atrás, y ANTES de la migración 3B (su CHECK impide filas tipo 'admin';
-- después de 3B hay que quitar ese CHECK primero). Aborta si alguna fila del backup ya existe en public.
-- Deja los triggers habilitados aun si falla (todo es transaccional).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
LOCK TABLE public.tareas_recurrentes, public.tareas IN SHARE ROW EXCLUSIVE MODE;
SELECT etapa3_backup.restaurar() AS restaurado;
-- Debe dar coincide = true en las cinco tablas antes de confirmar; si no, ROLLBACK.
SELECT * FROM etapa3_backup.comparar_con_vivo();
COMMIT;
