

## Resumen

Implementar reprogramacion y cancelacion de turnos en el flujo publico existente. Incluye 1 migracion SQL, actualizacion de 2 edge functions existentes, 3 edge functions nuevas, 3 componentes React nuevos, y actualizacion de 2 componentes existentes.

## 1. Migracion SQL

```sql
ALTER TABLE public.agenda_config
  ADD COLUMN IF NOT EXISTS cancelacion_limite_hs integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS modificacion_limite_hs integer NOT NULL DEFAULT 2;

ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_email text,
  ADD COLUMN IF NOT EXISTS cancelado_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_motivo text;
```

## 2. Actualizar `validate-turno`

Agregar `user_id` y `cliente_email` (del body) al INSERT del turno.

## 3. Actualizar `get-availability`

Aceptar param opcional `exclude_turno_id`. En la query de turnos existentes, agregar `AND id != exclude_turno_id` cuando presente.

## 4. Nueva edge function `get-my-turnos`

- Extraer JWT del Authorization header, decodificar user_id/email/phone
- Query segura: `(user_id = uid) OR (user_id IS NULL AND (cliente_email = email OR cliente_telefono = phone))`
- Filtro: `estado IN ('pendiente','confirmado') AND (fecha > CURRENT_DATE OR (fecha = CURRENT_DATE AND hora_inicio > NOW()::time))`
- JOIN con sucursales, barberos, servicios
- Calcular `puede_cancelar` y `puede_reprogramar` usando agenda_config limites
- Ordenar por fecha ASC, hora_inicio ASC

## 5. Nueva edge function `cancel-turno`

- Requiere JWT, valida ownership (misma logica segura)
- Valida estado IN ('pendiente','confirmado') y turno futuro
- Valida cancelacion_limite_hs
- UPDATE: estado='cancelado', cancelado_at=now(), cancelado_motivo

## 6. Nueva edge function `reschedule-turno`

- Requiere JWT, valida ownership
- Valida estado y turno futuro
- Valida modificacion_limite_hs contra turno original
- Verifica disponibilidad del nuevo slot excluyendo turno actual (reutiliza logica de availability con exclude)
- UPDATE fecha/hora_inicio/hora_fin

## 7. Componentes React

### `MisTurnosStep.tsx`
- Llama get-my-turnos, muestra cards con info completa
- Botones Reprogramar/Cancelar (disabled con tooltip si no cumple limite)
- Estado vacio con CTA "Reservar turno"

### `CancelTurnoDialog.tsx`
- AlertDialog con motivo opcional
- Llama cancel-turno, refresh on success

### `RescheduleFlow.tsx`
- Reutiliza FechaStep y HorarioStep con exclude_turno_id
- Llama reschedule-turno al confirmar

## 8. Actualizar componentes existentes

### `BookingLanding.tsx`
- Activar card "Reprogramar / Cancelar" con callback `onManage()`

### `BookingStepper.tsx`
- Agregar `mode: 'book' | 'manage'` state
- Si manage: auth obligatorio → MisTurnosStep
- Callbacks para reschedule/cancel flows

### `ConfirmacionStep.tsx`
- Enviar `cliente_email` en el body de validate-turno

## Orden

1. Migracion SQL
2. validate-turno + get-availability updates
3. get-my-turnos, cancel-turno, reschedule-turno
4. MisTurnosStep, CancelTurnoDialog, RescheduleFlow
5. BookingLanding + BookingStepper integration

