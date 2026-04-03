

## Plan: Fixes en flujo de reserva + cancelar turnos desde agenda

### 1. Fix "Volver" cuando hay 1 sola sucursal

**Problema**: `goBack` va de step 1 a step 0, pero el `useEffect` auto-skip vuelve a step 1 inmediatamente.

**Solución** en `BookingStepper.tsx`: En `goBack`, si `step === 1` y `orgData.sucursales.length === 1`, llamar `onBackToLanding()` directamente en vez de ir a step 0.

### 2. Fix cuenta nueva no queda logueada

**Problema**: En `AuthStep`, tras `signUp` se llama `onAuthenticated()` inmediatamente, pero Supabase no crea sesión activa hasta que el usuario confirme email (o si email confirmation está desactivado, la sesión se crea pero puede no estar lista aún). Luego en `ConfirmacionStep`, `getSession()` retorna `null` y el turno se crea sin `user_id`.

**Solución** en `AuthStep.tsx`: Después de `signUp`, esperar a que `onAuthStateChange` dispare con una sesión válida antes de llamar `onAuthenticated()`. Si la confirmación por email está habilitada, mostrar mensaje de verificación sin avanzar. Si no, el listener detectará la sesión y avanzará automáticamente.

### 3. Invertir orden: login primero, registro después

**Cambio** en `AuthStep.tsx`: Cambiar `isLogin` default a `true` (iniciar sesión por defecto). El texto del toggle queda: "No tengo cuenta → Crear una" (cuando está en login) y "Ya tengo cuenta → Iniciar sesión" (cuando está en registro). Ya está así, solo cambiar el `useState(false)` a `useState(true)`.

### 4. Botón "Cancelar turno" en AgendaViewer

**Cambio** en `AgendaViewer.tsx`:
- Eliminar `getEstadoBadge` y el badge de estado de cada turno
- Agregar botón "Cancelar" (icono X o texto) en cada turno con estado `pendiente` o `confirmado`
- Al presionar, mostrar `AlertDialog` de confirmación con motivo opcional (reutilizar patrón de `CancelTurnoDialog`)
- Ejecutar update directo: `supabase.from('turnos').update({ estado: 'cancelado', cancelado_at, cancelado_motivo }).eq('id', turno.id)`
- Refrescar lista tras cancelar

### Archivos a modificar
- `src/components/reservar/BookingStepper.tsx` — fix goBack con 1 sucursal
- `src/components/reservar/AuthStep.tsx` — invertir default a login, fix signUp sin sesión
- `src/components/config/AgendaViewer.tsx` — reemplazar badge estado por botón cancelar con AlertDialog

