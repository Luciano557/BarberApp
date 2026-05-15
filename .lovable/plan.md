
## Finanzas — reordenar tabs

En `src/components/FinanzasPanel.tsx`:
- Cambiar `defaultValue="gastos"` a `defaultValue="estadisticas"`.
- Reordenar `TabsList` y `TabsContent`: Estadísticas, Sueldos, Gastos, Inversiones, Deudas.
- Para la cuenta de sucursal (vista reducida) mantener: Sueldos, Gastos (en ese orden) con `defaultValue="sueldos"`.

## Deudas — `src/components/DeudasPanel.tsx`

1. **Monto por cuota calculado**: quitar el input editable. Calcular automáticamente como `montoTotal / cuotasTotales` cuando ambos estén cargados y mostrarlo en modo solo lectura (texto formateado en moneda AR debajo del campo de cuotas, o input deshabilitado). En `handleSubmit` enviar el valor calculado.
2. **Renombrar sección**: el header `"Deudas"` pasa a `"Deudas Activas"`.
3. **Sección "Deudas pagadas"**: dividir el render en dos bloques. Filtrar `deudas` en dos arrays: `activas = deudas.filter(d => d.estado !== 'pagada')` y `pagadas = deudas.filter(d => d.estado === 'pagada')`. Renderizar primero "Deudas Activas" (con su empty state actual) y luego "Deudas Pagadas" (solo si hay registros, con un empty state breve si no). Reutilizar el mismo componente de Card; en pagadas ocultar el botón de pago.
4. **Botón "Pagar" → "Confirmar Pago"**: cambiar el label. La lógica actual (`registrarPago`) ya marca como pagada cuando se completan cuotas/monto; al pasar el monto total restante de una vez, automáticamente cae en "Deudas pagadas". Para deudas con cuotas, "Confirmar Pago" sigue registrando una cuota; pasa a "pagadas" sólo al completar.
5. **Confirmación de eliminación**: envolver la acción del tacho con `AlertDialog` (shadcn) con título "Eliminar deuda", descripción explicando que la acción es irreversible, y botones "Cancelar" / "Eliminar" (variante destructive). Sólo al confirmar se llama `deleteDeuda(d.id)`.

## Inversiones — `src/components/InversionesPanel.tsx`

- **Confirmación de eliminación**: igual patrón que Deudas, envolver el botón del tacho con `AlertDialog` antes de llamar `deleteInversion(inv.id)`.

## Sueldos — `src/components/SueldosPanel.tsx`

1. **Reemplazar "Devengado"** por **"A pagar"** en toda la UI visible (encabezados de fila, totales del resumen y la línea explicativa de sueldo fijo). No se renombran variables internas (`totalDevengado`, `calcularDevengadoFijo`, etc.) para no romper lógica.
2. **Eliminar presets "Últimos 15 días" y "Últimos 30 días"** del bloque de filtros.
3. **"Personalizado" como rango de fechas**:
   - Agregar estado `periodEndDate?: Date` además de `periodStartDate`.
   - Cambiar el `Popover` de "Personalizado" a un `Calendar mode="range"` con `selected={{ from: periodStartDate, to: periodEndDate }}`.
   - El botón muestra el rango formateado (`dd/MM/yyyy – dd/MM/yyyy`) o "Personalizado" si no hay selección.
   - En `fetchData`, agregar filtro adicional `lte('dia', endDateStr)` para `ingresos` y `lte('fecha', endDateStr)` para `pagos_sueldos` cuando `periodEndDate` esté seteado. Aplicar la misma cota superior a los filtros en memoria de comisión por equipo, bonos fijos y comisión por productos.
   - Para `calcularDevengadoFijo`, cambiar el `now` por `periodEndDate ?? new Date()` cuando hay rango personalizado.
   - Incluir `periodEndDate` en las dependencias de `useCallback`/`useEffect`.
   - Actualizar los textos del resumen ("A pagar (desde X hasta Y)").

## Notas técnicas

- Usar `AlertDialog` de `@/components/ui/alert-dialog` (ya existe en el proyecto).
- Mantener tokens semánticos y formato de moneda AR existente.
- No se requieren migraciones de DB ni cambios en hooks (`useDeudas`, `useInversiones`).
