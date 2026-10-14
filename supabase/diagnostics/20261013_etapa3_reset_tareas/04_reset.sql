-- Etapa 3 · BUILD 3 · Paso 4 — RESET DEFINITIVO. Destructivo.
-- Solo después de: backup creado (paso 1), verificación sin fallas (paso 2) y ensayo ok (paso 3). La copia
-- externa del schema etapa3_backup es opcional (decisión de Sebastián; ver README): el respaldo obligatorio
-- es el backup interno verificado.
-- Ejecutar lejos del minuto 00 (crons horarios de Tareas).
--
-- etapa3_backup.reset(): bloquea tareas y tareas_recurrentes (SHARE ROW EXCLUSIVE: nadie escribe, todos leen)
-- y las filas de notificaciones del alcance; recalcula el alcance y lo compara con el backup (cantidades,
-- conjuntos de ids, checksums); borra notifications → tareas (admin/tarea) → tareas_recurrentes; comprueba
-- las post-condiciones (alcance vacío, peticiones idénticas, nada ajeno perdido, sin huérfanas, tablas
-- protegidas y motor de la Etapa 2 sin cambios) y registra el reset. Cualquier falla aborta sin borrar.
-- Segunda ejecución: devuelve {"ya_aplicado": true, "borradas": 0} y no toca nada.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT etapa3_backup.reset() AS resultado;
COMMIT;
