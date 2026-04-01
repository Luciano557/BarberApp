

## Resumen

Definir políticas RLS estrictas para las 4 tablas del sistema de agenda (`agenda_config`, `horarios_trabajo`, `bloqueos_agenda`, `turnos`), aislando staff de clientes y exponiendo disponibilidad solo via endpoints controlados.

## Políticas RLS

### 1. `agenda_config`

Solo staff administrativo. Barberos pueden ver config de su sucursal (necesitan `duracion_base_min` para UI).

| Operación | Quién | Condición |
|-----------|-------|-----------|
| ALL | Owner, GM, Manager | `organization_id = get_user_organization_id(auth.uid())` |
| SELECT | Barber | `organization_id = get_user_organization_id(auth.uid()) AND sucursal_id IN (get_user_sucursal_ids(auth.uid()))` |

Sin acceso para `anon` ni clientes.

### 2. `horarios_trabajo`

| Operación | Quién | Condición |
|-----------|-------|-----------|
| ALL | Owner, GM, Manager | `organization_id = get_user_organization_id(auth.uid())` |
| SELECT | Barber | `organization_id = ... AND barbero_id = get_user_barbero_id(auth.uid())` |

Sin acceso para `anon`. Los clientes obtienen disponibilidad via edge function, no consultando esta tabla.

### 3. `bloqueos_agenda`

| Operación | Quién | Condición |
|-----------|-------|-----------|
| ALL | Owner, GM, Manager | `organization_id = get_user_organization_id(auth.uid())` |
| SELECT | Barber | `organization_id = ... AND barbero_id = get_user_barbero_id(auth.uid())` (incluye bloqueos de sucursal donde `barbero_id IS NULL` y `sucursal_id IN get_user_sucursal_ids`) |

Sin acceso para `anon`.

### 4. `turnos`

La tabla más sensible. Clientes no consultan directamente — la edge function `validate-turno` inserta con `service_role`.

| Operación | Quién | Condición |
|-----------|-------|-----------|
| ALL | Owner, GM, Manager | `organization_id = get_user_organization_id(auth.uid())` |
| SELECT | Barber | `organization_id = ... AND barbero_id = get_user_barbero_id(auth.uid())` |

Sin acceso para `anon`. La inserción de turnos por clientes se hace exclusivamente via la edge function `validate-turno` que usa `service_role_key` para bypassear RLS tras validar disponibilidad.

### 5. Flujo de clientes

```text
Cliente → Edge Function (get-availability) → consulta tablas con service_role → retorna slots
Cliente → Edge Function (validate-turno) → valida + inserta con service_role → retorna turno
```

Los clientes **nunca** ejecutan queries directas contra estas tablas. Las edge functions actúan como API gateway con validación.

## Migración SQL

Una sola migración que:
1. Habilita RLS en las 4 tablas (ya debería estar habilitado desde la migración anterior)
2. Crea las políticas usando las funciones `has_role()`, `get_user_organization_id()`, `get_user_barbero_id()` y `get_user_sucursal_ids()` ya existentes
3. Para `bloqueos_agenda` barberos: política SELECT que incluye bloqueos propios (`barbero_id = get_user_barbero_id`) OR bloqueos de sucursal (`barbero_id IS NULL AND sucursal_id IN get_user_sucursal_ids`)

## Detalle técnico

- Todas las políticas son `FOR authenticated` — no se crea ninguna política para `anon`
- Las edge functions usan `createClient(url, service_role_key)` para operar sin restricciones RLS
- El patrón es idéntico al usado en las demás tablas del proyecto (ej: `barberos`, `servicios`, `ingresos`)
- No se necesitan funciones `security definer` nuevas — las existentes cubren todos los casos

