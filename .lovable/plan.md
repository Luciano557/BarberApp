

## Problema

La tasa de ocupacion usa `barberosActivos` — un conteo estatico de los barberos activos HOY en la sucursal seleccionada — para calcular la capacidad de TODOS los meses historicos. Si en diciembre habia 2 barberos y hoy hay 2 en esa sucursal pero 9 en la org, o si en algun momento cambiaron, el dato sale mal.

Ademas, en modo "Todas las sucursales" (`currentSucursal === null`), la query no filtra y cuenta los 9 barberos de toda la organizacion.

## Solucion

Calcular los barberos activos **por mes** contando los `barbero_id` distintos que aparecen en la tabla `ingresos` de ese mes. Esto refleja exactamente cuantos barberos trabajaron cada mes, sin importar altas o bajas posteriores.

### Cambio en `src/components/EstadisticasPanel.tsx`

1. En la funcion `fetchData`, al procesar los ingresos agrupados por mes, agregar un campo `barberosDelMes` que cuente los `barbero_id` unicos de ese mes (requiere incluir `barbero_id` en el select de ingresos).

2. En el calculo de la tasa de ocupacion (linea 432), reemplazar:
```
const cap = capacidadDiaria * (barberosActivos || 1) * workDays;
```
por:
```
const cap = capacidadDiaria * (m.barberosDelMes || 1) * workDays;
```

3. Agregar `barbero_id` al select de la query de ingresos (linea 304) y al tipo `MonthlyData`.

4. Mantener `barberosActivos` solo para mostrar el dato informativo actual, no para el calculo de ocupacion.

### Archivos a modificar
- `src/components/EstadisticasPanel.tsx` — unico archivo afectado

