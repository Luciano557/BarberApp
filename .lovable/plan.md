
## Auditoría — `supabase/functions/reschedule-turno/index.ts`

Confirmado: tiene los mismos huecos que tenía `validate-turno`.

### Qué hace hoy

1. **Parámetros** (línea 45): `turno_id`, `nueva_fecha`, `nueva_hora_inicio`, `telefono`. `barbero_id`, `sucursal_id`, `organization_id`, `servicio_id` se leen del turno existente (línea 67-71). Autoriza por match exacto de `cliente_telefono` (línea 80).
2. **Anticipación mínima** (líneas 135-143): igual lógica que validate-turno (`slotInstantMs` + `anticipacion_minima_reserva_min`). **No incluye `antMin` en el payload** ni respeta convención nueva.
3. **Horario de apertura (`horarios_trabajo`)**: **NO valida**. Mismo agujero.
4. **Bloqueos de agenda**: **NO valida**. Mismo agujero.
5. **Buffers (líneas 145-159)**: usa `buffer_antes_min` / `buffer_despues_min` reales — ya alineado con validate-turno corregido. OK.
6. **`hora_fin`** (línea 145): `nueva_hora_inicio + duracion` (servicio o `duracion_base_min`). Igual que validate-turno.
7. **Otros chequeos**: `modificacion_limite_min` (líneas 125-133, código `modify_limit`), estado válido (`pendiente`/`confirmado`), turno no pasado.

### Frontend — `src/components/reservar/RescheduleFlow.tsx` (líneas 53-65)

Maneja `slot_taken` y `time_limit` (este último no existe en el backend, que devuelve `modify_limit`). El resto cae a toast genérico sin recovery. Mismo problema que tenía ConfirmacionStep.

---

## Plan

### A. `supabase/functions/reschedule-turno/index.ts`

Replicar los chequeos nuevos de validate-turno, en este orden, después de calcular `nueva_hora_fin` y antes del chequeo de conflictos:

1. Calcular `dbDow` desde `nueva_fecha` (`jsDow===0 ? 7 : jsDow`).
2. Query a `horarios_trabajo` (org, sucursal, `dia_semana=dbDow`, `activo=true`, `barbero_id.eq.${turno.barbero_id},barbero_id.is.null`).
3. Resolver overrides: si hay filas con `barbero_id === turno.barbero_id`, usarlas; si no, las de `barbero_id IS NULL`.
4. Verificar que `[nueva_hora_inicio, nueva_hora_fin]` esté contenido en algún intervalo → si no, `409 outside_working_hours` con mensaje "Ese horario está fuera del horario de atención del barbero."
5. Query a `bloqueos_agenda` (org, sucursal, `fecha_inicio<=nueva_fecha`, `fecha_fin>=nueva_fecha`); filtrar a `barbero_id === turno.barbero_id || null`; verificar solapamiento (`todo_el_dia` o `[bStart,bEnd)` vs slot) → si bloquea, `409 slot_blocked` con mensaje "Ese horario está bloqueado en la agenda."
6. Agregar `antMin` al payload de `slot_too_soon` (línea 139-142).

### B. `src/components/reservar/RescheduleFlow.tsx` (líneas 53-65)

Extender el manejo de errores igual que `ConfirmacionStep`:

- `slot_taken` → toast + `setStep("horario")` (ya existe).
- `slot_too_soon` → "Ese horario quedó muy cerca. Elegí otro." + `setStep("horario")`.
- `outside_working_hours` → "Ese horario ya no está disponible. Elegí otro." + `setStep("horario")`.
- `slot_blocked` → "Ese horario quedó bloqueado. Elegí otro." + `setStep("horario")`.
- `modify_limit` → "Este turno ya no puede modificarse." (reemplaza el branch erróneo `time_limit`).
- Resto → toast genérico (sin cambio).

### Orden

1. Backend (A) primero.
2. Frontend (B) después.

### Riesgos / efectos colaterales

- +2 queries por reagendamiento (~50-100ms). Aceptable.
- El override de `horarios_trabajo` por barbero debe respetarse igual que en get-availability/validate-turno para evitar falsos negativos.
- Comparación de borde: usar `<=` en `hora_inicio` del intervalo y `>=` en `hora_fin` (slot puede terminar exacto en el cierre).

### Qué NO tocar

- Autorización por teléfono, validación de estado, `modificacion_limite_min`, lógica de timezone.
- Manejo de `23P01` en el update.
- Resto de `RescheduleFlow` (UI de selección de fecha/horario, paso `done`).
