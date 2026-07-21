# Build — Corrección de queries `.in(ventaIds)` en Estadísticas

Sigo en plan mode. Cambio a build mode para ejecutar. El detalle exacto de lo que voy a escribir:

## Archivos

### 1. `src/components/estadisticas/useServiciosClientesData.ts` (rewrite)

- Firma nueva: sin `ventasData` (se retira del contrato porque ya no se consume).
- Query de `venta_extra` vía embed `!inner` a `venta`, tipando el select como `string` plano (`sel(...)`) para no disparar el parser de tipos costoso de supabase-js sobre el embed, y `.returns<ExtraRow[]>()` para pinear la forma:
  ```
  .select(sel('venta_id, cantidad, precio_extra, venta!inner(fecha_hora, organization_id, sucursal_id, estado)'))
  .eq('venta.organization_id', organizationId)
  .eq('venta.estado', 'activo')
  .gte('venta.fecha_hora', startDate.toISOString())
  .lte('venta.fecha_hora', endDate.toISOString())
  // + .eq('venta.sucursal_id', currentSucursal.id) si hay sucursal
  ```
- Agregación mensual usa `e.venta.fecha_hora` embebido — se elimina el `Map<venta_id, ...>` cruzado con `ventasData`.
- `useEffect` deps: `[organizationId, currentSucursal, periodoMeses, monthlyData]` (sin `ventasData`).
- Guard: `if (monthlyData.length === 0) return;` al inicio de `fetchData` — evita que un ciclo temprano pise el estado con ceros (padre aún cargando).
- Nuevo estado `error: string | null`. Reset a `null` al inicio de cada fetch; en `catch`, `setError('No se pudieron cargar las métricas de servicios y clientes')`.
- Return: `{ monthlyStats, isLoading, error }`.

### 2. `src/components/estadisticas/usePagoMetodoData.ts` (patch quirúrgico)

- Se mantiene la query de `venta` (necesaria para el fallback: ventas sin filas en `venta_pagos` cuentan con `venta.metodo_pago` + `venta.total_final`).
- Reemplazo del segundo fetch: en vez de `.in('venta_id', ventaIds)`, usar embed `!inner` a `venta` filtrado por `organization_id`, `estado='activo'`, `fecha_hora` en `[rangeStart, rangeEnd]` y opcionalmente `sucursal_id`. Mismo patrón que arriba, mismo `sel(...)` + `.returns<T>()`.
- El resultado (`{ venta_id, metodo_pago, monto }[]`) se sigue mapeando al `pagosPorVenta` existente sin cambios en el resto de la lógica.
- No aplica guard adicional: este hook no depende de `ventasData` de otro hook — arma su propio `venta` set. El patrón de doble-fetch existente ya es coherente.

### 3. `src/components/EstadisticasPanel.tsx` (cambios mínimos)

- Línea 96: quitar `ventasData` del llamado a `useServiciosClientesData`; desestructurar también `error: serviciosClientesError`.
- Insertar banner sobrio arriba del bloque de la Sección 4 (línea ~917), solo si `serviciosClientesError` no es null. Estilo alineado a tokens semánticos ya vigentes en el proyecto:
  ```tsx
  {serviciosClientesError && (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {serviciosClientesError}
    </div>
  )}
  ```
  (No introduce colores nuevos ni sombras; usa `destructive` — mismo token usado en el resto del panel para errores y acciones peligrosas.)

## Candado de alcance (NO se toca)
- `useEstadisticasData.ts`, `useTransactions.ts`, `useOcupacion*`, `useEquipoData`.
- Componentes visuales existentes (`MetricCard`, `DonutCard`, `RankingBarCard`, etc.).
- Migraciones SQL, RLS, edge functions.
- Comportamiento de "0 mientras carga" en cards individuales.

## Validación

1. `npx tsgo --noEmit` limpio.
2. `git status` + `git diff --stat` para confirmar los 3 archivos.
3. Reporte manual del usuario con: valor de "Tasa de Attach de Extras" > 0, ausencia de 400 en Network para `venta_extra` y `venta_pagos`, y banner visible al bloquear la request.

Necesito que apruebes para pasar a build mode y ejecutar.
