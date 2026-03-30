

## Devengado automático para empleados con sueldo fijo

### Contexto
Actualmente, el devengado solo se calcula para empleados por comisión (sumando `sueldo` de la tabla `ingresos`). Para empleados con sueldo fijo, el devengado aparece como $0 porque no tienen cierres de caja con comisiones. Esto hace que el panel de Sueldos sea inútil para ellos.

### Solución
Calcular el devengado de sueldo fijo de forma proporcional diaria (`sueldo_fijo / 30 * días transcurridos`) y agregar una fecha de cobro mensual configurable por empleado.

### Cambios

**1. Base de datos — migración**
- Agregar columna `fecha_cobro_dia` (integer, default 1) a la tabla `barberos`. Representa el día del mes en que se paga (1-28).

**2. Tipo Barber (`src/types/barbershop.ts`)**
- Agregar `payDay?: number` (1-28) al interface `Barber`.

**3. Mapeo de datos (`src/hooks/useSupabaseData.ts`)**
- Mapear `fecha_cobro_dia` ↔ `payDay` en lectura y escritura.

**4. Formulario de equipo (`src/components/config/EquipoUnificado.tsx`)**
- Cuando `compensationType === 'fijo'`, mostrar un campo adicional: "Día de cobro (1-28)" con input numérico. Default: 1.

**5. Panel de Sueldos (`src/components/SueldosPanel.tsx`)** — cambio principal
- En `fetchData`, para cada barbero con `compensationType === 'fijo'`:
  - Calcular devengado proporcional: `sueldo_fijo / 30 * días_transcurridos_en_periodo`
  - Si hay filtro de periodo: contar días desde `periodStartDate` hasta hoy (o fin de periodo)
  - Para saldo histórico: contar días desde `created_at` del barbero hasta hoy, aplicar `sueldo_fijo / 30 * total_días`
- Mostrar en el detalle expandible una fila explicativa: "Sueldo fijo: $X/mes — Y días → $Z devengado"
- El header de la columna "Comisión" cambia a "Devengado" (ya se muestra así)

**6. Indicador visual**
- En la lista de Sueldos, agregar un badge "Fijo" o "Comisión" junto al nombre del empleado para distinguir el tipo de compensación.

### Flujo resultante
1. Se configura un empleado con sueldo fijo de $350.000/mes, día de cobro 5.
2. El devengado se acumula diariamente: $350.000 / 30 ≈ $11.667/día.
3. El saldo pendiente crece automáticamente cada día.
4. Al registrar un pago manual, el saldo baja.
5. El día 5 de cada mes, el empleado "debería" cobrar — el saldo refleja cuánto se le debe.

### Archivos a modificar
1. Migración SQL: agregar `fecha_cobro_dia` a `barberos`
2. `src/types/barbershop.ts`: agregar `payDay`
3. `src/hooks/useSupabaseData.ts`: mapear `fecha_cobro_dia`
4. `src/components/config/EquipoUnificado.tsx`: campo día de cobro
5. `src/components/SueldosPanel.tsx`: cálculo proporcional + badge tipo compensación

