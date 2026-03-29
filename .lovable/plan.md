

## Resumen

Cuando una inversión tiene amortización activa, el sistema debe generar automáticamente un gasto fijo mensual en la tabla `Egresos` con categoría "Amortización de equipamiento". Esto se hará al cargar el panel de Gastos para un mes dado: si hay inversiones activas con amortización pendiente para ese mes y no se creó el egreso correspondiente, se inserta automáticamente.

---

## Detalle técnico

### Lógica de generación automática en `useGastos.ts`

Después de `fetchGastos`, agregar una función `syncAmortizaciones(month)` que:

1. Consulta inversiones activas de la organización/sucursal
2. Para cada inversión, calcula si el mes seleccionado cae dentro del período de amortización (entre `fecha_compra` y `fecha_compra + meses_amortizacion`)
3. Verifica si ya existe un egreso en `Egresos` para esa inversión en ese mes (usando `Descripcion` que contenga el ID de la inversión, o un nuevo campo `inversion_id`)
4. Si no existe, inserta automáticamente un egreso con:
   - `Categoria`: "Amortización de equipamiento"
   - `tipo_costo`: "fijo"
   - `Monto`: monto_total / meses_amortizacion
   - `Descripcion`: nombre de la inversión
   - `Fecha`: primer día del mes
   - `organization_id`, `sucursal_id` correspondientes

### Cambio en base de datos

Agregar columna `inversion_id` (uuid, nullable) a la tabla `Egresos` para vincular el egreso con la inversión y evitar duplicados.

### Archivos a modificar

- **Migration SQL**: agregar `inversion_id` a `Egresos`
- **`src/hooks/useGastos.ts`**: agregar función `syncAmortizaciones` que se ejecuta después de `fetchGastos`, importando la lógica de inversiones
- **`src/hooks/useGastos.ts`**: actualizar el tipo `Gasto` para incluir `inversion_id`

### Flujo

1. Usuario entra a Gastos → se carga el mes actual
2. `fetchGastos` trae los egresos del mes
3. `syncAmortizaciones` verifica inversiones activas, inserta egresos faltantes
4. Se vuelve a hacer fetch para mostrar los nuevos egresos
5. Los egresos de amortización aparecen en la tabla como cualquier otro gasto fijo, con badge "🧱 Fijo" y categoría "Amortización de equipamiento"

