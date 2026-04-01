

## Resumen

Implementar reprogramacion/cancelacion de turnos en el flujo publico existente con 3 ajustes de seguridad criticos: fallback seguro por email/telefono solo cuando `user_id IS NULL`, filtro temporal preciso con hora, y validacion completa del nuevo slot en reschedule.

## Migracion SQL

Agregar a `agenda_config`:
- `cancelacion_limite_hs integer NOT NULL DEFAULT 2`
- `modificacion_limite_hs integer NOT NULL DEFAULT 2`

Agregar a `turnos`:
- `user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL` (nullable)
- `cliente_email text` (nullable)
- `cancelado_at timestamptz` (nullable)
- `cancelado_motivo text` (nullable)

## Edge Functions

### Actualizar `validate-turno`
- Guardar `user_id` y `cliente_email` en el INSERT del turno

### Actualizar `get-availability`
- Aceptar param opcional `exclude_turno_id` para excluir un turno del calculo de conflictos (necesario para reschedule)

### `get-my-turnos`
- Extraer JWT → obtener `user_id`, `email`, `phone` del token
- Query con fallback SEGURO:
```sql
WHERE organization_id = X
  AND (
    user_id = uid
    OR (user_id IS NULL AND (cliente_email = email OR cliente_telefono = phone))
  )
  AND estado IN ('pendiente', 'confirmado')
  AND (fecha > CURRENT_DATE OR (fecha = CURRENT_DATE AND hora_inicio > CURRENT_TIME))
ORDER BY fecha ASC, hora_inicio ASC
```
- JOIN con sucursales, barberos, servicios para datos enriquecidos
- Calcular `puede_cancelar` y `puede_reprogramar` usando `cancelacion_limite_hs` / `modificacion_limite_hs` contra fecha+hora con timezone

### `cancel-turno`
- Requiere JWT, valida ownership (misma logica segura de fallback)
- Valida `estado IN ('pendiente', 'confirmado')` Y turno futuro
- Valida `cancelacion_limite_hs`
- UPDATE: `estado='cancelado'`, `cancelado_at=now()`, `cancelado_motivo` (opcional)

### `reschedule-turno`
- Requiere JWT, valida ownership
- Valida `estado IN ('pendiente', 'confirmado')` Y turno futuro
- Valida `modificacion_limite_hs` contra turno ORIGINAL
- Llama internamente la logica de `get-availability` con `exclude_turno_id` para verificar que el nuevo slot es valido y cumple reglas de agenda
- UPDATE turno con nueva fecha/hora_inicio/hora_fin
- Si conflict → error slot_taken

## Componentes React

### `BookingLanding.tsx`
- Activar card "Reprogramar / Cancelar" → `onManage()` callback

### `BookingStepper.tsx`
- Agregar `mode: 'book' | 'manage'` state
- Si `mode === 'manage'`: auth obligatorio primero → luego `MisTurnosStep`

### Nuevo: `MisTurnosStep.tsx`
- Llama `get-my-turnos` al montar
- Cards con: sucursal, barbero, servicio, fecha, hora, estado
- Botones "Reprogramar" y "Cancelar" (deshabilitados con tooltip si no cumple limite_hs)
- Estado vacio: mensaje + CTA "Reservar turno" que vuelve al modo book

### Nuevo: `CancelTurnoDialog.tsx`
- AlertDialog con motivo opcional (textarea)
- Llama `cancel-turno`
- On success: refresh lista + toast

### Nuevo: `RescheduleFlow.tsx`
- Reutiliza `FechaStep` y `HorarioStep` existentes
- Pasa `exclude_turno_id` a `get-availability`
- Al confirmar: llama `reschedule-turno`
- Error slot_taken → volver a horarios
- Error limite_hs → mensaje claro

## Orden de implementacion

1. Migracion SQL
2. Actualizar `validate-turno` (user_id, cliente_email)
3. Actualizar `get-availability` (exclude_turno_id)
4. Edge function `get-my-turnos`
5. Edge function `cancel-turno`
6. Edge function `reschedule-turno`
7. Componentes React: MisTurnosStep, CancelTurnoDialog, RescheduleFlow
8. Integrar en BookingLanding + BookingStepper

