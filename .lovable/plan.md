

## Problema encontrado

El bug esta en `get-availability/index.ts`, linea 138:

```js
const barberoIds = [...new Set(horarios.map((h: any) => h.barbero_id))];
```

Con el nuevo modelo de horarios (Stage 4), los horarios base de sucursal tienen `barbero_id = NULL`. Cuando un barbero NO tiene override, sus horarios no aparecen en la query porque solo se buscan registros con `barbero_id` real. El engine agrupa por `barbero_id` del resultado, encuentra `null`, intenta generar slots para un "barbero null" — que no es un barbero real — y descarta todo.

```text
Flujo actual (roto):
  horarios_trabajo WHERE dia_semana = X
  → solo encuentra rows con barbero_id = NULL (sucursal base)
  → barberoIds = [null]
  → genera slots para barbero "null"
  → slots inútiles (no hay barbero real asignado)

Flujo correcto:
  1. Fetch horarios con barbero_id IS NULL (sucursal base) + horarios con barbero_id real
  2. Fetch lista de barberos activos de la sucursal
  3. Para cada barbero real:
     - Si tiene override → usar sus horarios propios
     - Si no → usar horarios de sucursal como base
  4. Generar slots por barbero real
```

## Cambios

### `supabase/functions/get-availability/index.ts`

1. **Agregar fetch de barberos activos** de la sucursal (en paralelo con los demas queries). Si el cliente pidio `barbero_id` especifico, filtrar solo ese.

2. **Separar horarios base vs override**: del resultado de `horarios_trabajo`, separar los que tienen `barbero_id = NULL` (base sucursal) de los que tienen barbero especifico.

3. **Resolver jerarquia por barbero**: para cada barbero activo:
   - Si tiene registros propios en `horarios_trabajo` → usar esos
   - Si no → usar los registros de sucursal (barbero_id IS NULL) como sus intervalos

4. **Generar slots con barbero real**: el resto del pipeline (bloqueos, turnos, buffers, slot generation) se mantiene igual, pero ahora itera sobre barberos reales con intervalos correctamente resueltos.

### Detalle tecnico

- La query de `horarios_trabajo` ya NO filtra por `barbero_id` cuando el cliente no especifica uno — trae todos (base + overrides)
- Se agrega una query a `barberos` para obtener los IDs reales activos de la sucursal
- Si `barbero_id` se especifica en el request, se filtra tanto barberos como horarios a solo ese
- No hay cambios en la UI ni en el panel de gestion — el problema es puramente en el engine

### Archivo a redesplegar

Solo `supabase/functions/get-availability/index.ts` — se redespliega la edge function.

