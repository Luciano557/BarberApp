

## Rediseño del Panel de Estadísticas (revisado)

Agregar 9 métricas financieras como tarjetas nuevas **por encima** de los gráficos existentes. Los 3 gráficos actuales (Facturación mensual, Servicios por mes, Métodos de pago) se mantienen intactos.

---

## Cambios en `src/components/EstadisticasPanel.tsx`

### Datos adicionales
- Fetch de `Egresos` del período seleccionado, agrupados por `tipo_costo` (fijo, variable, semivariable)
- Calcular totales de costos fijos, variables y total de egresos

### 9 tarjetas de métricas (grid 3 cols desktop, 1 col mobile)

Cada tarjeta incluye: icono, título, valor calculado, y descripción breve (~200 chars) de por qué es importante.

1. **Facturación mensual** = suma `total_facturado`
2. **Costos fijos** = suma Egresos tipo fijo
3. **Rentabilidad** = ((Facturación - Total egresos) / Facturación) x 100
4. **Ticket promedio** = Facturación / cantidad servicios
5. **Costo fijo por servicio** = Costos fijos / servicios
6. **Costo variable por servicio** = Costos variables / servicios
7. **Ganancia por servicio** = Ticket promedio - costo fijo/serv - costo variable/serv
8. **Punto de equilibrio** = Costos fijos / Ganancia por servicio (clientes)
9. **Tasa de ocupación** = (Servicios reales / Capacidad máxima) x 100

### Tasa de ocupación
- Capacidad máxima diaria por defecto: **18 cortes**
- Input editable inline, guardado en `localStorage`
- Collapsible con explicación del cálculo
- Capacidad total = capacidad diaria x barberos activos x días laborables (lun-sáb)

### Gráficos existentes
Se mantienen los 3 gráficos sin cambios debajo de las métricas:
- Facturación Mensual (AreaChart)
- Servicios por Mes (BarChart)
- Métodos de Pago (BarChart stacked)

### Archivo a modificar
- `src/components/EstadisticasPanel.tsx`

