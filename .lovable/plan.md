# Estadísticas: una sola fuente de verdad para los números

Objetivo: que los datos de Finanzas › Estadísticas dejen de calcularse en el navegador con filas crudas y pasen a calcularse en la base, con el huso horario correcto y sin truncado silencioso. No se toca el diseño visual ni los permisos.

## Hallazgo nuevo que cambia el enfoque de un punto

`ingresos.dia` **no es una fecha de negocio**. Es una columna de texto que guarda el nombre del día de la semana ("sábado", "viernes", incluso con mayúsculas inconsistentes: "Martes", "Viernes"). No está vacía — está poblada al 100% — pero no sirve como fecha operativa. Verificado con consultas a la base.

Consecuencia: el punto 5 de la auditoría se reformula. No se puede "empezar a usar `dia`". Las opciones son:

- **Recomendada:** seguir usando `created_at`, pero convertido al huso horario de la sucursal del lado del servidor (`created_at AT TIME ZONE tz`). Es exactamente lo que ya hace `generar_resumenes_mensuales()` y produce el corte de mes correcto sin columnas nuevas.
- Alternativa descartada por ahora: agregar una columna `fecha_negocio date` poblada por trigger. Sirve si en el futuro el "día de negocio" deja de coincidir con el día calendario (cierres después de medianoche), pero hoy agrega una migración de datos histórica sin beneficio inmediato.

## A. Cambios en base de datos

Nada de lo existente se rompe: `generar_resumenes_mensuales()` y la tabla `resumenes_mensuales` quedan intactas (las usa el cron y el Resumen Mensual).

Se agregan **dos funciones nuevas de lectura**, en vez de estirar la función del cron (que devuelve solo 3 meses fijos y escribe en tabla):

1. `estadisticas_mensuales(org, sucursal, meses)` — devuelve una fila por mes con: facturación, servicios, efectivo, MP, recargos, pérdida, sueldo, comisión de productos, costos fijos/variables/semivariables, barberos del mes. Reemplaza el `reduce` de `useEstadisticasData`. Reusa la misma lógica de corte por huso que la función del cron.
2. `estadisticas_ventas_agregadas(org, sucursal, meses)` — devuelve los agregados que hoy salen de traer `venta` fila por fila: mix de servicios (monto y cantidad por servicio y mes), tasa de attach de extras y distribución por hora del día. Esto elimina el truncado de raíz.

Ambas: `SECURITY INVOKER` (respetan RLS tal cual) o `SECURITY DEFINER` con validación explícita de pertenencia a la organización más chequeo de sucursal asignada. Se decide en el build según cómo resuelvan las políticas actuales; la opción por defecto es INVOKER para no crear una vía de acceso nueva.

Corte de fecha unificado en ambas: `>= inicio_mes` y `< inicio_mes_siguiente`, con `AT TIME ZONE` de la sucursal (o de la organización como respaldo). Esto cierra los puntos 2 y 3 en un solo lugar.

## B. Truncado de `venta`: opciones y recomendación

| Opción | Pros | Contras |
|---|---|---|
| (a) Paginar con `.range()` | Cambio chico, sin migración | Sigue bajando decenas de miles de filas al navegador; en 12 meses de una organización grande son varias vueltas de red y un cálculo pesado en el teléfono. No escala |
| (b) Agregar en SQL (función nueva) | Devuelve decenas de filas en vez de miles; una sola fuente de verdad; el huso se resuelve en el servidor | Requiere migración y reescribir el hook |
| (c) Vista materializada | Muy rápida | Necesita refresco programado y agrega desfasaje de datos; innecesario a este volumen |

**Recomendación: (b)**, agregación en SQL. Es la única que además arregla huso y bordes en el mismo movimiento. La opción (a) queda solo como red de seguridad temporal (ver punto F).

## C. `ingresos.dia`

Ya respondido arriba: no es una fecha, es el nombre del día de la semana. El plan **no** hace que el frontend dependa de esa columna. Se usa `created_at` convertido al huso de la sucursal del lado del servidor. No se modifica ni se limpia la columna en esta tarea (la usan otras pantallas fuera del alcance).

## D. Huso horario

Ambos datos ya están disponibles: `sucursales.timezone` (ya expuesto en el contexto de sucursal del frontend) y `organizations.timezone` (ya en el contexto de organización). Se podría resolver en el cliente, pero **conviene resolverlo en el servidor**: es donde ya vive la lógica correcta y evita que el resultado dependa del dispositivo del usuario. Las funciones nuevas resuelven el huso internamente con el mismo respaldo que la función del cron: sucursal → organización → Buenos Aires. El frontend solo pasa cuántos meses quiere.

Para el modo "todas las sucursales" (sin sucursal seleccionada), la función agrega sobre todas las sucursales activas de la organización, cada una con su propio huso, y suma después.

## E. Orden de migración

1. **Paso 1 — Salvaguarda** (ver F): aviso de datos incompletos con el código actual. Sin migración. Riesgo nulo, beneficio inmediato.
2. **Paso 2 — Migración**: crear las dos funciones nuevas. Nada las consume todavía; se validan comparando sus números contra los actuales para varios meses y sucursales.
3. **Paso 3 — Ventas**: migrar `useServiciosClientesData` (mix de servicios, attach de extras, horarios pico) a la función agregada. Es donde está el error real hoy.
4. **Paso 4 — Ingresos y egresos**: migrar `useEstadisticasData` a la función mensual, manteniendo la misma forma de datos que hoy devuelve el hook para no tocar `EstadisticasPanel.tsx`.
5. **Paso 5 — Limpieza**: eliminar `useOcupacionData.ts` y, si queda sin consumidores, `ocupacionHelpers.ts` (hoy solo lo usa `useOcupacionData`). Quitar la salvaguarda del paso 1 donde ya no aplique.

Archivos tocados: `src/components/estadisticas/useEstadisticasData.ts`, `useServiciosClientesData.ts`, y eliminación de `useOcupacionData.ts` (más `ocupacionHelpers.ts`). `usePagoMetodoData.ts` y `useEquipoData.ts` quedan para una etapa siguiente salvo que la validación del paso 2 muestre que también truncan. `EstadisticasPanel.tsx` y los componentes visuales no se modifican.

## F. Salvaguarda mientras se migra

Mientras un hook siga leyendo filas crudas, se pide un registro más que el límite y se compara el largo del resultado con el límite. Si se alcanza, se marca el conjunto como incompleto y la pantalla muestra un aviso claro arriba de las tarjetas afectadas ("Los datos de este período están incompletos por volumen. Elegí un período más corto."), en vez de mostrar un número parcial sin señalarlo. El aviso desaparece solo cuando el hook correspondiente pasa a la función agregada.

## G. Fórmulas de negocio en un solo lugar

Hoy la misma fórmula vive en dos lados (el frontend y la función del cron) y nada obliga a mantenerlas iguales. La propuesta es separar dos capas y darle a cada una una única sede.

**Capa 1 — Fórmulas puras (funciones SQL chicas e inmutables).** Cada fórmula financiera queda como una función SQL `IMMUTABLE` que recibe números y devuelve un número, sin tocar tablas:

- `fin_rentabilidad_pct(facturacion, egresos)`
- `fin_ticket_promedio(facturacion, servicios)`
- `fin_costo_fijo_por_servicio(costos_fijos, servicios)`
- `fin_costo_variable_por_servicio(costos_variables, servicios)`
- `fin_ganancia_por_servicio(facturacion, costos_totales, servicios)`
- `fin_punto_equilibrio(costos_fijos, ganancia_por_servicio)`
- `fin_variacion_pct(actual, anterior)`

Todas resuelven igual los casos borde (división por cero → cero o nulo, según se defina una vez). Al ser inmutables y sin acceso a tablas son baratas y testeables.

**Capa 2 — Agregados (una vista y funciones que la usan).** Una vista `v_estadisticas_mensuales` concentra "cuánto se facturó, cuántos servicios y cuánto se gastó por organización, sucursal y mes", ya con el corte por huso horario resuelto. Las funciones de la sección A pasan a leer de esa vista y a componer las métricas llamando a las funciones de la capa 1. `generar_resumenes_mensuales()` se actualiza para calcular la rentabilidad con `fin_rentabilidad_pct(...)` en vez de su fórmula escrita a mano — cambio retrocompatible, mismo resultado numérico, verificable comparando los resúmenes ya generados antes y después.

**Por qué ambas cosas.** La vista da la fuente única de los *insumos* (y es consultable directo desde cualquier pantalla o reporte). Las funciones puras dan la fuente única de las *fórmulas*, y sirven también cuando los insumos vienen de otro lado (un cierre de caja, un reporte puntual, una proyección) sin tener que pasar por la vista.

**Fuera de la base.** No hace falta un módulo espejo en TypeScript. El frontend recibe las métricas ya calculadas. La única excepción admitida son cálculos de presentación (formateo de moneda, redondeo visual, estimaciones del mes en curso a partir de días transcurridos), que se quedan en `src/components/estadisticas/` y nunca redefinen una fórmula financiera.

**Convención a documentar** (en `AGENTS.md` y en un comentario en la migración):

1. Toda fórmula financiera nueva se define como función SQL con prefijo `fin_`. No se escribe la fórmula suelta dentro de otra función, vista o componente.
2. Todo agregado mensual de facturación, servicios o costos sale de `v_estadisticas_mensuales`. No se arma un `SUM` nuevo sobre `ingresos` o `Egresos` para eso.
3. El frontend no calcula métricas financieras: las consume ya resueltas.
4. Los comentarios "ESPEJO" que hoy avisan de la duplicación se eliminan cuando deja de haber duplicación — no se agregan comentarios nuevos de ese tipo; si aparece la tentación de escribir uno, es señal de que falta una función `fin_`.

## Candados respetados

- No se tocan roles, permisos ni el acceso a `finance.statistics`.
- No se modifica la estructura visual de `EstadisticasPanel.tsx`.
- No se tocan Cobrar, Resumen diario ni Cierres de caja.
- `generar_resumenes_mensuales()`, la tabla `resumenes_mensuales` y el cron quedan sin cambios.
