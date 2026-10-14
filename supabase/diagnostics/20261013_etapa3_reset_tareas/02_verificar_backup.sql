-- Etapa 3 · BUILD 3 · Paso 2 — Verificación del backup. SOLO LECTURA.
-- Todas las filas deben tener ok = true. Una sola en false detiene el proceso (no seguir al paso 3).
SELECT chequeo, detalle, ok FROM etapa3_backup.verificar() ORDER BY ok, chequeo;
