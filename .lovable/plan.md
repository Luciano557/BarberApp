

## Convertir "Servicios por Mes" y "Métodos de Pago" al mismo formato

### Problema
Los gráficos grandes de "Servicios por Mes" y "Métodos de Pago" (líneas 615-653) quedaron como `BarChart` simples sin el estilo unificado (ComposedChart con barras + línea) ni la vista expandida con tabla de variación que tienen las 9 tarjetas de métricas.

### Cambios en `src/components/EstadisticasPanel.tsx`

**1. Agregar variaciones de servicios, efectivo y MP a los datos**
- Extender `DerivedMonthlyMetrics` con campos: `servicios`, `efectivo`, `mp` y sus variaciones (`serviciosVar`, `efectivoVar`, `mpVar`)
- Calcular las variaciones en el mismo bloque donde se calculan las demás
- Agregar estos dataKeys a `varKeyMap` y `chartConfig`

**2. Convertir "Servicios por Mes" en tarjeta clickeable con mini-gráfico**
- Reemplazar el `Card` grande actual por una tarjeta igual a las métricas: valor del último mes como headline, badge de variación, mini ComposedChart (barras + línea)
- Definirlo como `MetricCardDef` con `dataKey: 'servicios'`, `formatFn: (v) => \`${v} servicios\``
- Agregarlo al array `ingresosCards`
- Click abre el `MetricDetailDialog` con gráfico grande + tabla de variación

**3. Convertir "Métodos de Pago" en dos tarjetas clickeables**
- Crear dos `MetricCardDef`: una para "Efectivo" (`dataKey: 'efectivo'`) y otra para "Mercado Pago" (`dataKey: 'mp'`)
- Cada una con su mini ComposedChart, valor del último mes, badge de variación
- Agregarlas al array `ingresosCards`
- Click abre el `MetricDetailDialog` igual que las demás

**4. Eliminar los dos bloques de `Card` grandes**
- Borrar las líneas 615-653 (los gráficos de Servicios por Mes y Métodos de Pago standalone)

### Resultado
El grupo "Ingresos y Ventas" tendrá 4 tarjetas uniformes: Facturación, Ticket Promedio, Servicios, Efectivo, Mercado Pago -- todas con el mismo estilo ComposedChart + click para detalle expandido.

