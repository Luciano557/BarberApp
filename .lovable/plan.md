

## Comparación "mismos días" para el mes en curso

### Problema
Las variaciones del mes actual comparan un mes incompleto contra uno completo, mostrando caídas irreales (-85%).

### Solución
Para el último mes del array (si es el mes en curso), comparar solo los primeros N días de ambos meses. Ejemplo: si hoy es 2 de abril, comparar lo del 1-2 de abril contra lo del 1-2 de marzo.

### Cambios en `src/components/EstadisticasPanel.tsx`

**1. Agregar `MonthlyData` parcial del mes anterior**

En `fetchData` (línea ~367), al construir `monthlyStats`, agregar para cada mes un sub-total de los primeros N días (`parcialPrimerosDias`). Esto se calcula filtrando `monthIngresos` y `monthEgresos` donde el día del mes (`getDate()`) sea <= `diasTranscurridos` (día actual del mes en curso).

Solo se necesita calcular esto para el mes anterior al actual — no para todos.

**2. Modificar el cálculo de variaciones (línea ~457)**

Para el último elemento del array, si su `month` coincide con el mes actual:
- Usar los valores parciales del mes anterior (primeros N días) como base de comparación en vez de los totales completos.
- Aplicar esto solo a métricas acumulativas: `servicios`, `facturacion`, `efectivo`, `mp`, `costosFijos`.
- Métricas unitarias (ticket promedio, rentabilidad, etc.) se comparan directo como hasta ahora.

**3. Indicador visual "(parcial)"**

En las tarjetas del mes actual, agregar un badge o texto pequeño "(parcial — X días)" junto al porcentaje de variación, para que el usuario sepa que es una comparación de período equivalente, no del mes completo.

### Lógica concreta

```typescript
const today = new Date();
const diaActual = today.getDate(); // ej: 2

// En el cálculo de variaciones, para el último mes:
if (isCurrentMonth && prev) {
  // Filtrar ingresos del mes anterior que caigan en día <= diaActual
  const prevParcial = monthlyData[i-1] con filtro día <= diaActual
  // Usar prevParcial para calcVariation en métricas acumulativas
}
```

### Archivo a modificar
- `src/components/EstadisticasPanel.tsx` — único archivo afectado

