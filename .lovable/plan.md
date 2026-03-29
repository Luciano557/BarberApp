

## Organizar Estadísticas en 3 Grupos

Reorganizar las 9 tarjetas de métricas (actualmente en un grid plano) en 3 secciones con título, descripción breve del grupo, y las tarjetas correspondientes dentro de cada sección.

---

## Estructura

### Grupo 1: Ingresos y Ventas
**Descripción:** "Estas métricas te muestran cuánto estás vendiendo y cómo evoluciona tu facturación."

Tarjetas incluidas:
- Facturación mensual
- Ticket promedio
- Servicios por Mes (el gráfico grande existente se mueve aquí dentro del grupo)
- Métodos de Pago (el gráfico grande existente se mueve aquí dentro del grupo)

### Grupo 2: Costos y Rentabilidad
**Descripción:** "Estas métricas te muestran cuánto estás ganando realmente después de todos los gastos."

Tarjetas incluidas:
- Costos Fijos
- Costo Fijo por Servicio
- Costo Variable por Servicio
- Ganancia por Servicio
- Rentabilidad
- Punto de Equilibrio

### Grupo 3: Capacidad y Eficiencia
**Descripción:** "Estas métricas te muestran qué tan bien estás aprovechando tu barbería."

Tarjetas incluidas:
- Tasa de Ocupación (con su input de capacidad diaria y collapsible de explicación)

---

## Cambios técnicos en `EstadisticasPanel.tsx`

- Reemplazar el grid plano de tarjetas por 3 secciones, cada una con un `<div>` que contiene:
  - Título del grupo (`h2` o `CardTitle` grande)
  - Descripción breve del grupo en `text-muted-foreground`
  - Grid 2 columnas (desktop) con las tarjetas de ese grupo
- Reorganizar el array `metricCards` en 3 sub-arrays o renderizar condicionalmente por grupo
- Mover los gráficos de "Servicios por Mes" y "Métodos de Pago" al final del Grupo 1
- Sin cambios en lógica de datos, cálculos ni fetch

