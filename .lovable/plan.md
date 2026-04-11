

## Plan actualizado: Comision extra por equipo para encargados (V1.3.2)

### Unico cambio respecto a V1.3.1: calculo por tramos de vigencia

Se corrige la logica de calculo en `SueldosPanel.tsx` para que respete los cambios de comision dentro del periodo liquidado.

---

### Logica anterior (incorrecta)

Tomaba la regla vigente al momento de liquidar y la aplicaba a todo el periodo. Si el porcentaje cambiaba el 11/04, recalculaba todo el mes con 7%.

### Logica nueva (correcta)

El calculo debe segmentar el periodo liquidado en tramos segun las reglas de vigencia de cada par encargado-barbero.

**Algoritmo**:

Para cada regla vigente durante alguna parte del periodo `[inicio_periodo, fin_periodo]`:

1. Calcular el tramo efectivo: `max(vigencia_desde, inicio_periodo)` hasta `min(vigencia_hasta ?? fin_periodo, fin_periodo)`
2. Filtrar los cierres de caja (`ingresos`) del barbero origen cuya fecha (`dia`) caiga dentro de ese tramo, con `estado = 'activo'`
3. Sumar `total_facturado` de esos cierres
4. Multiplicar por `porcentaje / 100`
5. Sumar todos los tramos para obtener el total de comision extra de ese barbero origen

**Ejemplo**:

Periodo liquidado: 01/04 al 14/04

Reglas de Tommy sobre Oscar:
- 5% vigente desde 01/03 hasta 10/04
- 7% vigente desde 11/04 (abierta)

Calculo:
- Tramo 1: 01/04–10/04 → sumar cierres de Oscar en esos dias × 5%
- Tramo 2: 11/04–14/04 → sumar cierres de Oscar en esos dias × 7%
- Total = suma de ambos tramos

### Query de reglas vigentes para el periodo

Cambiar de:

```
vigencia_desde <= hoy
```

A:

```sql
vigencia_desde <= fin_periodo
AND (vigencia_hasta IS NULL OR vigencia_hasta >= inicio_periodo)
```

Esto trae todas las reglas que tuvieron vigencia durante alguna parte del periodo, incluyendo reglas ya cerradas que aplican parcialmente.

### Desglose en UI

En el desglose por barbero dentro de Sueldos, si hubo cambio de porcentaje en el periodo, mostrar el resultado consolidado por barbero (suma de tramos). El porcentaje mostrado sera el vigente al cierre del periodo (la regla mas reciente).

```
Oscar (7%*): $35.000
* Porcentaje vigente al cierre. Hubo cambios de comision durante el periodo.
```

Alternativa mas simple para V1: mostrar solo el monto total por barbero sin asterisco, con el porcentaje actual. El historial de tramos queda como dato interno de calculo, no se expone en UI.

### Todo lo demas de V1.3.1 se mantiene sin cambios

- Tablas, indices, 3 triggers, RLS, CHECK constraint scope/sucursal
- Reglas abiertas hasta nuevo aviso
- Calculo dinamico sobre cierres de caja validos
- UI de configuracion y desglose en Sueldos
- Una sola config activa por encargado

### Archivos a crear/modificar (sin cambios)

| Archivo | Accion |
|---|---|
| Migracion SQL | Crear tablas, indices, 3 triggers, RLS |
| `src/components/config/ComisionEquipoConfig.tsx` | Nuevo: UI config reglas por barbero |
| `src/components/config/EquipoUnificado.tsx` | Integrar ComisionEquipoConfig en ficha de encargados |
| `src/components/SueldosPanel.tsx` | Fetch reglas por tramos, calcular comision extra segmentada, mostrar desglose |

