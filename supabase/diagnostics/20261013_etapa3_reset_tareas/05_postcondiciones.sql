-- Etapa 3 · BUILD 3 · Paso 5 — Post-condiciones después del COMMIT. SOLO LECTURA.
-- Todas deben dar ok = true. También sirve como comprobación de idempotencia (el alcance sigue vacío).
SELECT chequeo, detalle, ok FROM etapa3_backup.postcondiciones() ORDER BY ok, chequeo;
