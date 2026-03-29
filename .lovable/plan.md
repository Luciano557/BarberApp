

## Gastos Recurrentes

Agregar la opción de marcar un gasto fijo como recurrente al registrarlo, reutilizando el mismo sistema de repetición de Tareas (RepeatPicker + CustomRepeatSheet). El sistema generará automáticamente los egresos correspondientes al abrir el panel de Gastos.

---

## Detalle técnico

### Nueva tabla: `gastos_recurrentes`

Almacena las "plantillas" de gastos recurrentes. Campos principales:

- `id` (uuid, PK)
- `organization_id`, `sucursal_id`
- `categoria`, `tipo_costo`, `monto`, `descripcion`
- `repeat_preset` (daily, weekly, monthly, etc.)
- `repeat_frequency`, `repeat_interval`, `repeat_byweekday` (para custom)
- `fecha_inicio` (date) - desde cuándo empieza a generar
- `proxima_fecha` (date) - próxima fecha en que se debe generar un egreso
- `activo` (boolean, default true)
- `created_at`

RLS: misma política que Egresos (owner, GM, manager full access).

### Columna en Egresos

Agregar `gasto_recurrente_id` (uuid, nullable) para vincular egresos generados automáticamente y evitar duplicados.

### Lógica de sincronización en `useGastos.ts`

Agregar `syncGastosRecurrentes()` que:

1. Consulta `gastos_recurrentes` activos de la org/sucursal
2. Para cada uno, si `proxima_fecha <= hoy`, genera el egreso en `Egresos` con `gasto_recurrente_id`
3. Calcula la siguiente `proxima_fecha` según el preset/frecuencia y actualiza el registro
4. Repite hasta que `proxima_fecha > hoy` (por si pasaron varios períodos sin abrir)

Se ejecuta junto con `syncAmortizaciones` al cargar el panel.

### UI en `GastosPanel.tsx`

- Cuando `tipoCosto === 'fijo'`, mostrar un toggle "Recurrente" debajo del formulario
- Al activar, mostrar selector de repetición (reutilizando `RepeatPicker` y `CustomRepeatSheet` existentes)
- En el historial, los gastos recurrentes generados automáticamente se muestran como cualquier otro gasto
- Agregar una sección o botón para ver/gestionar los gastos recurrentes activos (listar, pausar, eliminar)

### Archivos a modificar/crear

- **Migration SQL**: crear tabla `gastos_recurrentes` + agregar `gasto_recurrente_id` a `Egresos`
- **`src/hooks/useGastos.ts`**: agregar `syncGastosRecurrentes`, CRUD de recurrentes, actualizar tipo `Gasto`
- **`src/components/GastosPanel.tsx`**: agregar toggle recurrente en formulario, reutilizar RepeatPicker/CustomRepeatSheet, sección de gestión de recurrentes

### Flujo

1. Usuario registra gasto fijo → activa "Recurrente" → elige frecuencia (ej: cada 1 mes)
2. Se guarda en `gastos_recurrentes` con `proxima_fecha = fecha elegida`
3. Al abrir Gastos, `syncGastosRecurrentes` genera egresos pendientes hasta hoy
4. Los egresos aparecen normalmente en el historial

