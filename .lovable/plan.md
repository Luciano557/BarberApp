
## Auditoría (Fase 1)

### `supabase/functions/validate-turno/index.ts`

**1. Cálculo de `hora_fin` (líneas 137-138)**
```ts
const duracion = servicio.duracion_min || config?.duracion_base_min || 30;
const hora_fin = minutesToTime(timeToMinutes(hora_inicio) + duracion);
```
Suma `servicio.duracion_min` (sin buffer). Si falta, usa `duracion_base_min`.

**2. Construcción de checkStart/checkEnd y query de conflictos (líneas 171-182)**
```ts
const bufferBefore = config?.buffer_antes_min || 0;
const bufferAfter  = config?.buffer_despues_min || 0;
const checkStart = minutesToTime(timeToMinutes(hora_inicio) - bufferBefore);
const checkEnd   = minutesToTime(timeToMinutes(hora_fin)    + bufferAfter);

const { data: conflicts } = await supabase
  .from("turnos")
  .select("id")
  .eq("barbero_id", barbero_id)
  .eq("fecha", fecha)
  .in("estado", ["pendiente", "confirmado", "en_curso"])
  .or(`and(hora_inicio.lt.${checkEnd},hora_fin.gt.${checkStart})`);
```
Solapamiento clásico `[checkStart, checkEnd)` vs `[t.hora_inicio, t.hora_fin)`.

**3. Validación de horario de apertura**: **NO EXISTE**. No se consulta `horarios_trabajo` ni `bloqueos_agenda`. Solo se valida: `barberos_sucursales.disponible`, servicio, sucursal activa, anticipación mínima y conflictos con otros turnos.

### `supabase/functions/_shared/availability.ts` — `computeBarberSlots` (líneas 83-117)

**4. Construcción de slots**
```ts
const totalSlotDuration = params.duracion + params.bufferAfter;
// ... intervals = horarios − bloqueos − (turnos expandidos ±buffers) ...
for (const iv of intervals) {
  let cursor = iv.start;
  while (cursor + totalSlotDuration <= iv.end) {
    slots.push({
      hora_inicio: minutesToTime(cursor + params.bufferBefore),
      hora_fin:    minutesToTime(cursor + params.bufferBefore + params.duracion),
    });
    cursor += params.duracion_base_min || params.duracion;
  }
}
```
- `bufferAfter` se reserva *dentro* del slot (lo hace consumir más espacio del horario).
- `bufferBefore` corre la hora visible hacia adelante.
- **Primer slot del día**: sin tratamiento especial. Con `bufferBefore=0` (forzado por get-availability, línea 154), el primer slot = exactamente la apertura (ej. 11:00).

### Diagnóstico cruzado

| Aspecto | get-availability | validate-turno |
|---|---|---|
| `bufferBefore` para conflictos | `0` (hardcoded, línea 154) | `config.buffer_antes_min` (real) |
| `bufferAfter` | `config.buffer_despues_min` | `config.buffer_despues_min` |
| Validación de `horarios_trabajo` | Sí (filtra slots por día) | **No** |
| Validación de `bloqueos_agenda` | Sí | **No** |
| Anticipación mínima | Sí (filtra) | Sí (rechaza con `slot_too_soon`) |

Con `buffer_antes_min=0` (caso Lomas), A no debería romper el slot 11:00 sin turnos previos. El bug reportado (4×409 seguidos) es compatible con: el **primer intento creó un turno `pendiente` y los reintentos vieron conflicto consigo mismos**, o un transitorio en `barberos_sucursales.disponible`. Sin el código de error exacto no podemos cerrar la causa raíz, pero el plan cierra los huecos estructurales que permiten estos escenarios y mejora el diagnóstico para el próximo caso.

---

## Plan (Fase 2)

### A. Alinear lógica de buffers entre las dos funciones

**`supabase/functions/get-availability/index.ts`** (línea 154)
- Reemplazar `const bufferBefore = 0;` por `const bufferBefore = config.buffer_antes_min || 0;`.
- Así los slots ofrecidos y los conflictos chequeados al confirmar usan la misma regla.

**`supabase/functions/validate-turno/index.ts`** (líneas 171-182)
- Mantener el uso de `buffer_antes_min` / `buffer_despues_min` reales (queda alineado con el cambio anterior).
- Conservar la query de overlap.

> Decisión: alinear hacia el valor real del config (no hacia `0`). Es la fuente de verdad y respeta lo que el dueño configuró.

### B. Validar horario de apertura (y bloqueos) en `validate-turno`

En `supabase/functions/validate-turno/index.ts`, antes del chequeo de conflictos (después de calcular `hora_fin`):

1. Calcular `dbDow` a partir de `fecha` (mismo método que get-availability: `jsDow===0 ? 7 : jsDow`).
2. Query a `horarios_trabajo` filtrando por `organization_id`, `sucursal_id`, `dia_semana=dbDow`, `activo=true`, con la misma resolución de overrides por barbero que usa get-availability (override del barbero si existe, si no el base con `barbero_id IS NULL`).
3. Verificar que el rango `[hora_inicio, hora_fin]` esté **completamente** contenido en al menos uno de los intervalos de horario resuelto.
4. Query a `bloqueos_agenda` (igual que get-availability) y verificar que el rango no caiga dentro de ningún bloqueo (considerando `todo_el_dia`).
5. Devolver errores específicos con HTTP 409:
   - `{ error: "outside_working_hours", message: "Ese horario está fuera del horario de atención del barbero." }`
   - `{ error: "slot_blocked", message: "Ese horario está bloqueado en la agenda." }`

Adicional sin costo: agregar `antMin` al payload de `slot_too_soon` para que la UI pueda dar contexto:
```ts
{ error: "slot_too_soon", message: "...", antMin }
```

### C. Manejo de `slot_too_soon`, `outside_working_hours` y `slot_blocked` en la UI

**`src/components/reservar/ConfirmacionStep.tsx`** (líneas 46-54)

Extender el branch actual: tratar `slot_too_soon`, `outside_working_hours` y `slot_blocked` igual que `slot_taken` (toast + `onSlotTaken()` para volver al paso 3 y refrescar disponibilidad).

Mensajes:
- `slot_too_soon` → "Ese horario quedó muy cerca. Elegí otro." (la disponibilidad actualizada lo va a esconder).
- `outside_working_hours` → "Ese horario ya no está disponible. Elegí otro."
- `slot_blocked` → "Ese horario quedó bloqueado. Elegí otro."

No tocar el resto de los branches (`invalid_phone`, `barber_not_available_in_sucursal`) que ya requieren acción del usuario en otro paso.

### Orden de aplicación

1. **B** primero (validate-turno: horarios + bloqueos + errores nuevos). Cierra el agujero más grave (turnos fuera de horario).
2. **A** después (alinear `bufferBefore` en get-availability). Cambio chico pero requiere re-verificar disponibilidad existente.
3. **C** al final (UI). Depende de los códigos nuevos de B.

### Riesgos y efectos colaterales

- **A** puede *reducir* slots ofrecidos en sucursales con `buffer_antes_min > 0`. Es el comportamiento correcto, pero conviene avisarlo en el changelog interno.
- **B** agrega 2 queries por confirmación. Latencia +~50-100ms; aceptable. Reutilizar la lógica de resolución de horarios (override vs base) que ya está en get-availability — extraerla a `_shared/availability.ts` si queda duplicada.
- La función `reschedule-turno` probablemente tiene el mismo agujero. Fuera de scope de este plan, pero anotarlo para un follow-up.
- Los slots de borde exacto (hora_fin = cierre) deben aceptarse: usar comparación `hora_fin <= intervalo.fin` (no `<`).

### Qué NO tocar

- Lógica de `slotInstantMs` y manejo de timezone.
- CRM sync (clientes / clientes_sucursales).
- Inserción del turno y manejo de `23P01`.
- Resto de branches de error en `ConfirmacionStep` (`invalid_phone`, `barber_not_available_in_sucursal`).
- `get-available-dates` y `reschedule-turno` (follow-up separado).
- Estructura de `BookingStepper` y demás steps.
