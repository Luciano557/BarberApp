# Cierre del reporte del job `generar-resumenes-mensuales`

Dos de los tres puntos ya están verificados por consulta directa a la base. El tercero (prueba de fallo controlado) escribe y borra una fila, así que necesita aprobación antes de ejecutarse.

## 1. Comando exacto dentro del `cron.schedule` — verificado

Consulta a `cron.job`:

```text
jobname:  generar-resumenes-mensuales
schedule: 0 5 5 * *
command:  SELECT public.generar_resumenes_mensuales_job();
active:   true
```

El job llama al **envoltorio** `generar_resumenes_mensuales_job()`, no a `generar_resumenes_mensuales()` directamente. Eso es lo que garantiza el logueo de errores.

## 2. Comentario sobre la limitación de zona horaria — no existe

Revisé los `COMMENT ON` de ambas funciones y los comentarios de espejo en los tres archivos de origen. **No hay ningún comentario documentando una limitación de zona horaria.** Lo único que existe hoy es:

`COMMENT ON FUNCTION public.generar_resumenes_mensuales_job(date)`:

```text
Envoltorio de generar_resumenes_mensuales() usado por el job pg_cron generar-resumenes-mensuales. Captura cualquier error y lo registra en public.cron_job_errors para evitar fallos silenciosos.
```

`COMMENT ON FUNCTION public.generar_resumenes_mensuales(date)`: **NULL** (sin comentario).

Comentarios de espejo existentes (ninguno menciona zona horaria):

- `src/components/estadisticas/useEstadisticasData.ts:49` — facturación / cantidad de servicios / egresos por `tipo_costo`.
- `src/components/estadisticas/usePagoMetodoData.ts:19` — desglose por método de pago con fallback `venta_pagos → venta`.
- `src/components/EstadisticasPanel.tsx:140` — fórmula de rentabilidad.

La limitación en sí sí existe en el código SQL: la función resuelve la ventana de cada mes con `COALESCE(NULLIF(s.timezone,''), NULLIF(o.timezone,''), 'America/Argentina/Buenos_Aires')`, es decir, cae a la zona de Buenos Aires cuando la sucursal y la organización no tienen zona horaria cargada. Está implementado pero no documentado.

## 3. Prueba de fallo controlado — pendiente de aprobación

Plan de ejecución:

1. Invocar `public.generar_resumenes_mensuales_job('not-a-date-safe-trigger')` no sirve (el tipo `date` valida antes de entrar). En su lugar, forzar el fallo desde dentro: ejecutar el envoltorio con un `target_mes` extremo (`'0001-01-01'`) y verificar si rompe; si no rompe, provocar el error renombrando temporalmente nada — en su lugar se usa una llamada directa que dispare la excepción capturada.
2. Método definitivo, sin tocar objetos existentes: ejecutar `SELECT public.generar_resumenes_mensuales_job('0001-01-01');` y luego revisar `cron_job_errors`. Si no genera error, se crea una función temporal de prueba con el mismo patrón de captura para validar que el `INSERT` en `cron_job_errors` funciona, y se la borra al terminar.
3. Consultar la fila resultante en `public.cron_job_errors` y reportar `job_name`, `error_message`, `error_detail` y `contexto` textuales.
4. Borrar la fila de prueba y confirmar que la tabla queda como estaba.

Riesgo: `generar_resumenes_mensuales('0001-01-01')` podría insertar filas reales en `resumenes_mensuales` para ese mes ficticio si no falla. En ese caso también se borran esas filas en la limpieza.

## Opcional (fuera del alcance actual)

Si querés, en una build aparte agrego el `COMMENT ON FUNCTION public.generar_resumenes_mensuales(date)` documentando la limitación de zona horaria (fallback a Buenos Aires cuando sucursal y organización no la tienen cargada) y el corte mensual en hora local.
