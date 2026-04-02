

## Problema

La tasa de ocupación del mes en curso tiene dos defectos:

1. **Valor absoluto inflado/desinflado**: Se dividen los servicios parciales (ej: solo 2 días) por la capacidad del mes completo (ej: 22 días laborales), dando una tasa artificialmente baja.
2. **Variación engañosa**: Se compara esa tasa baja contra la tasa completa del mes anterior, mostrando caídas irreales.

## Solución

Aplicar la misma lógica de "mismos días" a la tasa de ocupación:

### Cambios en `src/components/EstadisticasPanel.tsx`

**1. Crear función `getWorkDaysUpTo(year, month, maxDay)`**

Similar a `getWorkDaysInMonth` pero cuenta días laborales solo hasta el día `maxDay` (inclusive). Se usa para calcular la capacidad parcial.

**2. Ajustar el cálculo de `tasaOcupacion` para el mes actual (línea ~480)**

Cuando el mes es el actual, usar `getWorkDaysUpTo(y, mo-1, diaActual)` en vez de `getWorkDaysInMonth(y, mo-1)`. Así la capacidad refleja solo los días transcurridos y la tasa es realista.

**3. Calcular tasa de ocupación parcial del mes anterior (en la sección `needsPartial`, línea ~412)**

Agregar `parcialTasaOcupacion` al modelo: usando `parcialServicios` dividido por la capacidad de los primeros N días laborales del mes anterior (`getWorkDaysUpTo`).

**4. Usar parcial en la variación (línea ~538)**

Cambiar `tasaOcupacionVar` para que, cuando `useSameDayComparison`, compare contra `parcialTasaOcupacion` del mes anterior en vez de la tasa completa.

### Resultado

- Si hoy es 2 de abril, la tasa de ocupación de abril se calcula sobre 2 días laborales de capacidad.
- La variación compara contra la tasa de los primeros 2 días de marzo.
- El tooltip "(parcial — X días)" ya aplicado a las demás métricas cubrirá esta también.

