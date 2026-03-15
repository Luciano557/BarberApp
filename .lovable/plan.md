

# Restringir validación de PIN por sucursal

## Problema

La Edge Function `validate-pin` busca el PIN en TODOS los barberos de la organización, sin importar la sucursal. Si Sebastián (dueño) está viendo datos de SDAD y usa el PIN de Tomás (encargado de Casa Central), el PIN se valida exitosamente y desbloquea acceso a datos de SDAD, donde Tomás no tiene rol.

## Reglas de negocio

- **Dueño / Enc. General**: Su PIN funciona en cualquier sucursal (acceso global).
- **Encargado de Local**: Su PIN solo funciona si la sucursal actual coincide con la sucursal del barbero vinculado.
- **Barbero**: Su PIN solo funciona en su sucursal asignada.

## Cambios

### 1. Edge Function `validate-pin` — Agregar parámetro `sucursal_id`

Recibir `sucursal_id` en el body junto con `pin`. Después de encontrar el barbero por PIN hash:

1. Buscar qué roles tiene el usuario vinculado a ese barbero (`profiles.barbero_id` → `user_roles`).
2. Si el barbero tiene rol `owner` o `general_manager` → validar sin restricción de sucursal.
3. Si tiene rol `manager` o `barber` → verificar que `barbero.sucursal_id === sucursal_id` enviado. Si no coincide → rechazar.
4. Si no hay `sucursal_id` enviado (modo "Todas") → solo permitir si el barbero tiene rol global.

### 2. Frontend — Enviar `sucursal_id` al validar PIN

Actualizar todos los puntos que llaman a `validate-pin`:

- **`usePinProtection.ts`** → `validatePin(pin)` debe enviar `currentSucursal?.id` en el body.
- **`VoidTransactionDialog.tsx`** → enviar `currentSucursal?.id`.
- **`TareasPanel.tsx`** → enviar `currentSucursal?.id` (2 llamadas: crear petición y acciones).

En cada caso, obtener `currentSucursal` del contexto `useSucursal()`.

### 3. Respuesta enriquecida de `validate-pin`

Además de `valid`, `user_name`, `barbero_id`, incluir `barbero_sucursal_id` en la respuesta para que el frontend pueda mostrar mensajes descriptivos si falla (ej: "Este PIN no tiene acceso a esta sucursal").

## Archivos a modificar

- `supabase/functions/validate-pin/index.ts` — agregar lógica de sucursal
- `src/hooks/usePinProtection.ts` — pasar `sucursal_id` al invocar
- `src/components/VoidTransactionDialog.tsx` — pasar `sucursal_id`
- `src/components/TareasPanel.tsx` — pasar `sucursal_id` (2 llamadas)

## Flujo resultante

```text
PIN ingresado + sucursal_id actual
  → validate-pin busca barbero por hash
  → encuentra barbero → busca perfil/usuario vinculado
  → revisa roles del usuario vinculado:
     owner/GM → ✅ válido
     manager/barber → barbero.sucursal_id == sucursal_id? → ✅/❌
  → Si no match → "PIN no autorizado en esta sucursal"
```

