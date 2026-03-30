

## Resumen simple

El usuario tiene razón: para calcular el promedio de servicios por día de semana hay que usar los datos de **cierres de caja** (`ingresos`), no los tickets individuales (`venta`). La tabla `venta` solo tiene los cobros registrados en tiempo real, pero muchos días se cierran diferidos/regularizados y esos servicios solo existen en `ingresos.cantidad_de_servicios`.

Para ventas por hora, sí corresponde usar `venta` porque tiene la hora exacta de cada transacción.

---

## Plan de corrección

### Archivo: `src/components/EstadisticasPanel.tsx`

**Cambio 1 — Guardar datos de `ingresos` para comportamiento**

Los datos de `ingresos` ya se traen en `fetchData` (línea 301-307) con `created_at` y `cantidad_de_servicios`. Guardarlos en un nuevo estado `ingresosRaw` para que `behaviorData` pueda usarlos.

**Cambio 2 — Ventas por día de semana: usar `ingresos` en vez de `venta`**

En el `useMemo` de `behaviorData` (línea 636):
- Para `byDay`: iterar `ingresosRaw`, agrupar por día de semana usando `created_at`, sumar `cantidad_de_servicios` de todos los barberos del mismo día (agrupando por fecha exacta primero, luego por día de semana).
- Dividir por `actualOccurrences[día]` (cantidad real de martes, miércoles, etc. en el período).
- Esto incluye tanto cierres normales como diferidos.

**Cambio 3 — Ventas por hora y horarios pico: mantener `venta`**

Siguen usando `ventasData` (tabla `venta`) porque necesitan la hora exacta. Agregar una nota aclaratoria debajo del gráfico: "Basado en cobros registrados en tiempo real".

**Cambio 4 — Mostrar sección si hay datos de cualquier fuente**

Cambiar la condición `ventasData.length > 0` para que la sección de comportamiento se muestre si hay `ingresosRaw` O `ventasData`.

### Resultado esperado

Los promedios por día de semana deberían coincidir con lo que el usuario ve en cierres de caja (10+ servicios por martes, no 3.4).

