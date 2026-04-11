

## Plan actualizado: Comision extra por equipo para encargados (V1.3.3)

Dos cambios respecto a V1.3.2. Todo lo demas se mantiene.

---

### Cambio 1: Calculo cierre por cierre, no por tramos agregados

**Antes (V1.3.2)**: Se agrupaban cierres por tramo de vigencia, se sumaba `total_facturado` del tramo, y se multiplicaba por el porcentaje del tramo.

**Ahora (V1.3.3)**: Para cada cierre individual del barbero origen, se busca la regla cuyo rango `[vigencia_desde, vigencia_hasta]` contenga la fecha de ese cierre, y se aplica ese porcentaje al `total_facturado` de ese cierre.

Algoritmo en `SueldosPanel.tsx`:

```
Para cada cierre del barbero origen (con estado = 'activo'):
  1. Extraer la fecha del cierre (ver Cambio 2)
  2. Buscar la regla donde vigencia_desde <= fecha_cierre AND (vigencia_hasta IS NULL OR vigencia_hasta >= fecha_cierre)
  3. Si hay regla: comision += total_facturado * porcentaje / 100
  4. Si no hay regla vigente para esa fecha: no se computa comision
```

El resultado es equivalente al calculo por tramos cuando no hay gaps, pero es mas preciso y mas simple de implementar. No requiere armar rangos ni intersectarlos.

### Cambio 2: Usar la fecha real del cierre de caja

La fecha de referencia para determinar que porcentaje aplica es la **fecha de negocio del cierre**, almacenada en `ingresos.created_at`.

En el sistema actual, `created_at` se graba con `getEndOfDayLocal(date, tz)` al momento de cerrar caja, representando el fin del dia de trabajo (ej: `2026-04-11T23:59:59-03:00` para un cierre del 11/04). Esta es la fecha correcta de negocio.

Para extraer la fecha comparable con `vigencia_desde`/`vigencia_hasta` (que son tipo `date`):

```typescript
// Extraer fecha local del cierre
const fechaCierre = format(new Date(ingreso.created_at), 'yyyy-MM-dd');
```

Solo se computan cierres con `estado = 'activo'`.

### Query de reglas: sin cambios

Se mantiene el fetch de todas las reglas que se solapan con el periodo:

```sql
vigencia_desde <= fin_periodo
AND (vigencia_hasta IS NULL OR vigencia_hasta >= inicio_periodo)
```

La diferencia es que ahora las reglas se usan como lookup table para cada cierre, no para armar tramos.

### Desglose en UI: sin cambios

Se muestra el monto total consolidado por barbero origen. El porcentaje mostrado es el vigente al cierre del periodo (la regla mas reciente).

### Todo lo demas de V1.3.2 se mantiene

- Tablas, indices, 3 triggers, RLS, CHECK constraint scope/sucursal
- Reglas abiertas hasta nuevo aviso
- UI de configuracion (ExtrasCompensacion + ComisionEquipoConfig)
- Una sola config activa por encargado

### Archivos a crear/modificar

| Archivo | Accion |
|---|---|
| `src/components/config/ComisionEquipoConfig.tsx` | Nuevo: UI config reglas por barbero |
| `src/components/config/ExtrasCompensacion.tsx` | Nuevo: seccion wrapper escalable |
| `src/components/config/EquipoUnificado.tsx` | Integrar ExtrasCompensacion en ficha de encargados |
| `src/components/SueldosPanel.tsx` | Fetch reglas, calcular comision cierre por cierre usando fecha de negocio, mostrar desglose |

