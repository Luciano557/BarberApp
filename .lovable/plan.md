

## Estadísticas mes a mes (no acumuladas)

El problema: actualmente las 9 métricas muestran valores acumulados del período completo (ej: facturación total de 6 meses). El usuario quiere ver las métricas **mes a mes**, pudiendo seleccionar qué mes ver.

---

## Cambios en `src/components/EstadisticasPanel.tsx`

### Nuevo selector de mes

- Agregar un segundo `Select` para elegir el mes específico a visualizar (ej: "Marzo 2026", "Febrero 2026", etc.)
- Las opciones se generan dinámicamente según el período seleccionado (3, 6 o 12 meses)
- Por defecto muestra el mes actual
- El selector de período (3/6/12 meses) sigue controlando el rango de los gráficos

### Calcular métricas por mes (no acumuladas)

- Extender `MonthlyData` para incluir costos del mes: `costosFijos`, `costosVariables`, `costosSemivariables`, `totalEgresos`
- En `fetchData`, al procesar cada mes, filtrar también los `Egresos` de ese mes y calcular costos fijos/variables/semivariables por mes
- Nuevo estado `selectedMonth` (string `yyyy-MM`) para saber qué mes mostrar en las tarjetas

### Las 9 tarjetas usan datos del mes seleccionado

En lugar de usar `totalFacturacion`, `costs.fijos`, etc. (acumulados), se toman los valores del mes elegido:

1. **Facturación** = `monthData.facturacion`
2. **Costos fijos** = `monthData.costosFijos`
3. **Rentabilidad** = `((facturación - totalEgresos) / facturación) x 100`
4. **Ticket promedio** = `facturación / servicios`
5. **Costo fijo por servicio** = `costosFijos / servicios`
6. **Costo variable por servicio** = `costosVariables / servicios`
7. **Ganancia por servicio** = `ticket - costoFijo/serv - costoVar/serv`
8. **Punto de equilibrio** = `costosFijos / ganancia por servicio`
9. **Tasa de ocupación** = `servicios / (capacidad diaria x barberos x días laborables del mes) x 100`

### Gráficos

Se mantienen los 3 gráficos mostrando la evolución de todo el período (3/6/12 meses) sin cambios.

### Archivo a modificar

- `src/components/EstadisticasPanel.tsx`

