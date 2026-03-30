

## Resumen simple

El problema es que el código actual toma el `created_at` (que se guarda como 23:59:59 con offset de timezone) y lo convierte de vuelta a hora local para sacar el día de la semana. Esa conversión puede fallar por diferencias de timezone o DST, haciendo que un cierre del sábado aparezca como lunes.

Pero ya existe una solución mucho más robusta: la columna **`dia`** en la tabla `ingresos`, que guarda directamente el nombre del día en español ("lunes", "martes", etc.) basándose en la fecha seleccionada al momento de crear el cierre. No depende de ninguna conversión de timestamp.

---

## Plan de corrección

### Archivo: `src/components/EstadisticasPanel.tsx`

**Cambio 1 — Agregar `dia` al query de ingresos**

En la línea 304, agregar `dia` a los campos del select:
```
.select('id, created_at, total_facturado, efectivo, mp, cantidad_de_servicios, sueldo, estado, dia')
```

**Cambio 2 — Usar `dia` en vez de convertir `created_at`**

En el `useMemo` de `behaviorData` (líneas 662-687), reemplazar la lógica que convierte `created_at` a fecha local para sacar el día de semana. En su lugar:

1. Crear un mapa de nombre español a índice: `{ 'domingo': 0, 'lunes': 1, 'martes': 2, ... }`
2. Para agrupar por fecha exacta (evitar contar doble el mismo día), seguir usando `created_at` solo como clave de agrupación por fecha, pero usar `dia` para determinar el día de semana.
3. Iterar `ingresosRaw`, agrupar `cantidad_de_servicios` por `dia` directamente (sumando todos los barberos del mismo día de semana), y dividir por `actualOccurrences[d]`.

Esto elimina completamente la dependencia de la conversión timezone de `created_at` para determinar el día de semana.

### Detalle técnico

```text
Antes:
  created_at "2025-03-15T23:59:59-03:00"
  → new Date(...).toLocaleString('en-US', { timeZone })
  → puede dar sábado o domingo según edge cases
  → getDay() → índice potencialmente incorrecto

Ahora:
  dia = "sábado" (guardado al crear el cierre)
  → mapeo directo: "sábado" → 6
  → sin conversión de timestamp, sin ambigüedad
```

### Resultado esperado

Los lunes ya no aparecerán con datos si nunca se trabajó un lunes. El día de semana viene directamente de la columna `dia`, que refleja el día real que el usuario seleccionó al cerrar caja.

