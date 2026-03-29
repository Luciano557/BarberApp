

## Unificar gráficos y agregar variación mensual clickeable

### Problema actual
- Algunos mini-gráficos son `AreaChart` y otros `BarChart` -- inconsistente
- No se puede ver la variación porcentual mes a mes en cada métrica

### Cambios en `src/components/EstadisticasPanel.tsx`

**1. Unificar tipo de gráfico**
- Todos los mini-gráficos dentro de las tarjetas usarán **BarChart + Line combinados** (ComposedChart de Recharts)
- Las barras muestran el valor absoluto del mes; la línea muestra la tendencia
- Eliminar el prop `type` de `MetricChart` y el `MetricCardDef.type`

**2. Agregar variación mensual (% de cambio)**
- En `DerivedMonthlyMetrics`, agregar un campo de variación para cada métrica (ej: `facturacionVar`, `ticketPromedioVar`, etc.)
- Calcular: `((valorMesActual - valorMesAnterior) / valorMesAnterior) * 100` para cada mes
- En el tooltip del gráfico, mostrar tanto el valor absoluto como la variación % respecto al mes anterior

**3. Click en tarjeta para ver detalle expandido**
- Al hacer click en una tarjeta de métrica, se abre un `Dialog` con:
  - Gráfico grande (ComposedChart) con barras + línea de tendencia
  - Tabla debajo con columnas: Mes | Valor | Variación % vs mes anterior
  - Flechita verde (↑) o roja (↓) según si subió o bajó
- Estado `selectedMetric` para controlar qué dialog está abierto

### Archivos a modificar
- `src/components/EstadisticasPanel.tsx`

