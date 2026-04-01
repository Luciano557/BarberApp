

## Resumen

Ajustes finales al diseño del motor de agenda antes de implementar: timezone explícito en constraint DB, validación de buffers en backend, bloqueos multi-día reales, orden de reglas documentado, y ordenamiento de barberos disponibles.

## Plan

### 1. Migración SQL — Timezone explícito en rango_horario

La columna generada `rango_horario` debe construirse con el timezone de la organización, no depender del timezone del servidor.

**Problema**: `(fecha || ' ' || hora_inicio)::timestamptz` usa el timezone de la conexión PostgreSQL (UTC por defecto en Supabase), no el del negocio.

**Solución**: Agregar columna `timezone` a la tabla `turnos` (copiada de la organización al insertar) y usarla en la columna generada:

```sql
-- En la tabla turnos, agregar:
timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',

-- Columna generada con timezone explícito:
rango_horario tstzrange GENERATED ALWAYS AS (
  tstzrange(
    ((fecha || ' ' || hora_inicio)::timestamp AT TIME ZONE timezone),
    ((fecha || ' ' || hora_fin)::timestamp AT TIME ZONE timezone),
    '[)'
  )
) STORED
```

Esto garantiza que `AT TIME ZONE` convierte correctamente a UTC para comparación, sin importar config del servidor. Funciona bien con DST para países que lo usan (Chile, Paraguay, etc.).

### 2. Validación de buffers en backend — Edge function

Crear edge function `validate-turno` que se invoca antes de insertar un turno:

1. Recibe `sucursal_id`, `barbero_id`, `fecha`, `hora_inicio`, `servicio_id`
2. Consulta `agenda_config` para obtener buffers
3. Consulta `servicios` para obtener `duracion_min`
4. Calcula `hora_fin` = `hora_inicio + duracion_min`
5. Busca turnos existentes activos del mismo barbero en esa fecha
6. Valida que no haya solapamiento considerando buffers (turno_existente.hora_fin + buffer_despues <= nuevo.hora_inicio AND nuevo.hora_fin + buffer_despues <= turno_existente.hora_inicio)
7. Si válido → inserta el turno y retorna. Si no → retorna error 409.

Esto previene race conditions donde dos clientes pasan validación frontend simultáneamente.

### 3. Engine — Bloqueos multi-día reales

Cambiar la lógica de bloqueos nocturnos de "split en 2 días" a iteración por rango real:

```text
Para cada bloqueo:
  - Generar lista de fechas afectadas: desde fecha_inicio hasta fecha_fin (inclusive)
  - Para cada fecha afectada:
    - Si es fecha_inicio y hora_inicio != null: bloquear desde hora_inicio hasta fin del día
    - Si es fecha_fin y hora_fin != null: bloquear desde inicio del día hasta hora_fin
    - Si es fecha intermedia: bloquear día completo
    - Si fecha_inicio == fecha_fin: bloquear hora_inicio → hora_fin
```

Esto cubre correctamente bloqueos de viernes 22:00 a domingo 10:00 (3 días).

### 4. Engine — Orden de reglas documentado y forzado

El engine debe aplicar reglas siempre en este orden estricto:

```text
1. Generar slots base desde horarios_trabajo (rangos del día)
2. Filtrar slots que caen en bloqueos
3. Filtrar slots que colisionan con turnos existentes
4. Aplicar buffers (reducir ventanas libres por buffer_antes/buffer_despues)
5. Validar que el servicio completo quepa en el slot restante
```

Esto se implementa como pipeline de funciones encadenadas en `availabilityEngine.ts`, donde cada paso recibe el output del anterior. El orden está forzado por la estructura del código (no es configurable).

### 5. Engine — Ordenamiento de barberosDisponibles

Cuando `barberoId` es null (cliente elige "cualquiera"), el array `barberosDisponibles[]` en cada `TimeSlot` se ordena por carga del día (menos turnos activos primero):

```text
Para cada slot:
  - Contar turnos activos del día para cada barbero disponible
  - Ordenar ascendente por cantidad de turnos
  - En caso de empate: orden alfabético por nombre
```

Esto permite asignación automática futura (tomar el primero del array = barbero con menos carga).

### Resumen de cambios vs plan anterior

| Ajuste | Antes | Ahora |
|--------|-------|-------|
| Timezone en constraint | Cast implícito del servidor | `AT TIME ZONE` explícito con tz del turno |
| Validación de buffers | "Validar antes de insertar" (ambiguo) | Edge function backend con lock implícito |
| Bloqueos multi-día | Split en 2 días | Iteración por rango real de fechas |
| Orden de reglas | Implícito | Pipeline forzado por estructura de código |
| barberosDisponibles | Sin orden definido | Ordenado por menor carga del día |

