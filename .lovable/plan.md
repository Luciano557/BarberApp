

## Agregar sección "Comportamiento del Cliente" a Estadísticas

### Resumen
Agregar un nuevo grupo (Grupo 4) al panel de Estadísticas con 3 métricas basadas en la tabla `venta`: ventas por día de semana, ventas por hora del día, y horarios pico.

### Fuente de datos
Se usará la tabla `venta` (columna `fecha_hora`) filtrada por el mismo período, organización y sucursal que ya usa el panel. Se traerán todas las ventas activas del período y se agruparán en el frontend por día de semana y hora.

### Métricas

1. **Ventas por día de semana** - Gráfico de barras horizontal/vertical mostrando lun-dom con la cantidad promedio de ventas por día. Permite ver qué días son más fuertes.

2. **Ventas por hora del día** - Gráfico de barras mostrando franjas horarias (9h-21h aprox.) con cantidad promedio de ventas. Permite ver en qué horarios se concentra la actividad.

3. **Horarios pico** - Card resumen que muestra el día + hora con más actividad (ej: "Sábados a las 11hs"), destacando los top 3 momentos de mayor demanda.

### Cambios técnicos

**Archivo**: `src/components/EstadisticasPanel.tsx`

1. **Fetch adicional en `fetchData`**: Agregar query a `venta` para traer `fecha_hora` de ventas activas del período. Almacenar en nuevo estado `ventasData`.

2. **Procesamiento**: Crear funciones que agrupen las ventas por:
   - Día de semana (0-6) → promedio semanal
   - Hora del día (0-23) → promedio diario
   - Combinación día+hora → top 3 picos

3. **UI**: Agregar después del Grupo 3 una nueva sección "👥 Comportamiento del Cliente" con:
   - Card de Ventas por día de semana con BarChart (recharts)
   - Card de Ventas por hora del día con BarChart
   - Card de Horarios pico con los top 3 momentos destacados

4. **Timezone**: Usar `organization.timezone` para convertir `fecha_hora` (UTC) a hora local antes de agrupar, asegurando que las horas reflejen el horario real del negocio.

