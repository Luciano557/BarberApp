

## Persistir capacidad diaria por sucursal en la base de datos

### Problema
La capacidad diaria se guarda en `localStorage` con una clave única (`estadisticas_capacidad_diaria`), sin distinguir por sucursal ni organización. Al cambiar de sucursal, el valor se mantiene igual y no se puede configurar independientemente.

### Solución

**1. Nueva tabla `sucursal_settings` en Supabase**
- Columnas: `id` (uuid PK), `sucursal_id` (uuid, unique), `organization_id` (uuid), `capacidad_diaria` (integer, default 18), `created_at`, `updated_at`
- RLS: Owner, GM y Manager pueden leer/escribir dentro de su organización
- Migración SQL

**2. Modificar `EstadisticasPanel.tsx`**
- Eliminar el `localStorage` para `capacidadDiaria`
- Al cargar datos (`fetchData`), consultar `sucursal_settings` para la sucursal actual y setear `capacidadDiaria` con el valor guardado (o 18 por defecto)
- Al cambiar el input de capacidad, hacer `upsert` en `sucursal_settings` (con debounce o en `onBlur`) para persistir el valor por sucursal
- Cuando `currentSucursal` cambia, recargar el valor correspondiente

### Resultado
Cada sucursal tendrá su propia capacidad diaria persistida en la DB, visible para todos los usuarios con acceso, y se actualizará automáticamente al cambiar de sucursal.

