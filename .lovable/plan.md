

## Soporte para tipo de pago (comisión vs. fijo) y empleados generales

### Contexto actual
- La tabla `barberos` almacena solo barberos con un campo `comision` (porcentaje).
- El panel de Sueldos (`SueldosPanel`) solo muestra barberos y calcula su "devengado" en base a comisiones de cierres de caja.
- No existe concepto de "empleado con sueldo fijo" ni de empleados no-barberos (community managers, limpieza, etc.).
- En Gastos, las categorías de sueldos no se generan automáticamente.

### Qué se necesita

1. **Tipo de compensación por barbero/empleado**: campo `tipo_compensacion` en la tabla `barberos` con valores `comision` (actual, default) o `fijo`.
2. **Sueldo fijo mensual**: campo `sueldo_fijo` (numeric) para quienes cobran fijo.
3. **Clasificación automática en Gastos**: cuando un empleado cobra fijo, su sueldo aparece como gasto fijo ("Sueldos fijos"); cuando cobra comisión, aparece como semivariable ("Sueldos y comisiones").
4. **Empleados no-barberos**: A futuro se podría extender con una tabla `empleados` separada, pero por ahora el usuario pide poder definir el tipo de pago dentro del sistema existente y que los sueldos fijos se reflejen en gastos.

### Plan de implementación

**Paso 1 — Migración de base de datos**
- Agregar a la tabla `barberos`:
  - `tipo_compensacion text NOT NULL DEFAULT 'comision'` (valores: `comision`, `fijo`)
  - `sueldo_fijo numeric DEFAULT NULL` (monto mensual si tipo = fijo)

**Paso 2 — Actualizar tipo TypeScript `Barber`**
- En `src/types/barbershop.ts`, agregar `compensationType: 'comision' | 'fijo'` y `fixedSalary?: number`.

**Paso 3 — Actualizar formularios de staff**
- En `EquipoUnificado.tsx` y `StaffConfig.tsx`:
  - Agregar selector "Tipo de compensación": Comisión / Fijo.
  - Si es "Comisión": mostrar campo `comision` (% como ahora).
  - Si es "Fijo": mostrar campo `sueldo_fijo` (monto mensual), ocultar comisión.

**Paso 4 — Actualizar `useSupabaseData.ts`**
- Mapear los nuevos campos al leer/escribir barberos.

**Paso 5 — Actualizar `SueldosPanel`**
- Para barberos con tipo `fijo`: el "devengado" mensual es el `sueldo_fijo` (proporcional si hay filtro de período), no la comisión de cierres.
- Renombrar "Resumen por barbero" → "Resumen por empleado".

**Paso 6 — Agregar categorías de sueldos en Gastos**
- En `CATEGORIAS_POR_TIPO` de `GastosPanel.tsx`:
  - Agregar "Sueldos fijos" a costos fijos.
  - Confirmar que "Sueldos y comisiones del personal" ya existe en semivariables.

### Alcance de esta iteración
- Se modifica la tabla `barberos` existente (no se crea tabla nueva de empleados).
- Se agregan los campos y la UI para elegir tipo de compensación.
- Se actualiza la clasificación en el panel de gastos.
- No se agrega aún una tabla separada de "empleados generales" — eso sería una iteración futura si el usuario lo necesita.

### Archivos a modificar
1. **Nueva migración SQL** — `ALTER TABLE barberos ADD COLUMN tipo_compensacion...`
2. `src/types/barbershop.ts` — Nuevos campos en `Barber`
3. `src/hooks/useSupabaseData.ts` — Mapeo de campos
4. `src/components/config/EquipoUnificado.tsx` — UI tipo compensación
5. `src/components/config/StaffConfig.tsx` — UI tipo compensación
6. `src/components/SueldosPanel.tsx` — Lógica fijo vs. comisión, renombrar a "empleado"
7. `src/components/GastosPanel.tsx` — Agregar categoría "Sueldos fijos"

