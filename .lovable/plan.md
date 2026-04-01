

## Resumen

Implementar el flujo completo de reserva publica en `/:orgSlug/reservar` con 3 edge functions backend y una pagina React con stepper progresivo. Ajustes clave vs plan anterior: auth se mueve al paso pre-confirmacion, manejo explicito de "sin disponibilidad", y datos publicos solo via edge function.

## Arquitectura

```text
/:orgSlug/reservar (public, no ProtectedRoute)
    │
    ├─ Edge: get-org-public → org name, sucursales, servicios, barberos
    ├─ Edge: get-availability → slots disponibles por fecha/barbero/servicio
    └─ Edge: validate-turno → validacion final + insercion con service_role
```

## Plan de implementacion

### 1. Edge function `get-org-public`

Recibe `org_slug`. Usa `service_role` para consultar:
- `organizations` (nombre, logo_url) filtrado por slug + is_active
- `sucursales` activas de esa org (id, nombre)
- `barberos` activos por sucursal (id, nombre, apellido, sucursal_id) donde rol_equipo = 'barbero'
- `servicios` activos por sucursal (id, nombre, precio, duracion_min, sucursal_id)

Retorna JSON publico sin datos sensibles. Validacion con Zod. CORS headers.

### 2. Edge function `get-availability`

Recibe: `organization_id`, `sucursal_id`, `servicio_id`, `fecha`, `barbero_id?` (opcional = "cualquiera").

Pipeline (service_role):
1. Obtener `agenda_config` de la sucursal (duracion_base, buffers, dias_anticipacion)
2. Obtener `duracion_min` del servicio
3. Obtener `horarios_trabajo` para el dia_semana de la fecha, filtrado por barbero(s) activos
4. Restar `bloqueos_agenda` para esa fecha
5. Restar `turnos` existentes (estado IN pendiente, confirmado, en_curso)
6. Aplicar buffers antes/despues
7. Generar slots donde cabe el servicio completo
8. Si barbero_id es null: retornar slots con array de barberos disponibles ordenados por menor carga del dia

Retorna: `{ slots: [{ hora_inicio, hora_fin, barberos: [{id, nombre}] }] }`

### 3. Edge function `validate-turno`

Recibe: `organization_id`, `sucursal_id`, `barbero_id`, `servicio_id`, `fecha`, `hora_inicio`, `cliente_nombre`, `cliente_telefono`, `user_id?`

1. Validar inputs con Zod
2. Recalcular disponibilidad del slot exacto (prevenir race conditions)
3. Calcular `hora_fin` = hora_inicio + duracion_min
4. Insertar turno con service_role (timezone de la sucursal/org)
5. Si exclusion constraint falla → retornar error + slots actualizados
6. Retornar turno confirmado

### 4. Pagina React `ReservarPage`

**Ruta**: `/:orgSlug/reservar` en App.tsx (fuera de ProtectedRoute y providers internos)

**Stepper progresivo** (estado local, sin redirecciones):

1. **Landing** — 2 cards: "Reservar turno" (activo) + "Modificar/Cancelar" (disabled)
2. **Sucursal** — lista de sucursales (skip automatico si hay solo 1)
3. **Servicio** — servicios de la sucursal seleccionada
4. **Barbero** — barberos de la sucursal + opcion "Cualquiera disponible"
5. **Fecha** — calendario, default hoy, limitado por dias_anticipacion
6. **Horario** — slots desde `get-availability` (carga bajo demanda). Si no hay slots:
   - Mensaje: "No hay turnos disponibles para esta seleccion"
   - Sugerencias: cambiar fecha, otro barbero, "Cualquiera disponible"
   - Nunca pantalla vacia
7. **Auth inline** — solo aparece si el usuario NO tiene sesion. Si ya esta autenticado se salta directo a confirmacion. Formulario con: nombre, email, telefono, fecha nacimiento + toggle "Ya tengo cuenta" / "Crear cuenta"
8. **Confirmacion** — resumen (sucursal, barbero, fecha, hora, servicio) + boton "Confirmar turno" → llama `validate-turno`

**UX critica**:
- Barra de progreso con chips de selecciones previas
- Mobile-first (cards grandes, touch-friendly)
- Loading spinner al consultar disponibilidad
- Error "slot tomado" → volver a paso horario con slots recalculados
- Todo el estado se mantiene en memoria (no se pierde al autenticarse)

### 5. Ruta en App.tsx

Agregar antes del catch-all:
```
<Route path="/:orgSlug/reservar" element={<ReservarPage />} />
```

## Componentes a crear

| Archivo | Descripcion |
|---------|-------------|
| `src/pages/Reservar.tsx` | Pagina principal, carga org via get-org-public |
| `src/components/reservar/BookingLanding.tsx` | Landing con 2 cards |
| `src/components/reservar/BookingStepper.tsx` | Contenedor del stepper con estado |
| `src/components/reservar/SucursalStep.tsx` | Seleccion de sucursal |
| `src/components/reservar/ServicioStep.tsx` | Seleccion de servicio |
| `src/components/reservar/BarberoStep.tsx` | Seleccion de barbero |
| `src/components/reservar/FechaStep.tsx` | Calendario de fecha |
| `src/components/reservar/HorarioStep.tsx` | Slots disponibles + manejo "sin disponibilidad" |
| `src/components/reservar/AuthStep.tsx` | Auth inline (login/registro) |
| `src/components/reservar/ConfirmacionStep.tsx` | Resumen + confirmar |
| `supabase/functions/get-org-public/index.ts` | Edge function datos publicos |
| `supabase/functions/get-availability/index.ts` | Edge function motor disponibilidad |
| `supabase/functions/validate-turno/index.ts` | Edge function confirmacion turno |

## Orden de implementacion

1. Edge function `get-org-public`
2. Edge function `get-availability`
3. Edge function `validate-turno`
4. Pagina `ReservarPage` con todos los steps
5. Ruta en `App.tsx`

No se requieren migraciones SQL — las tablas y RLS ya estan creadas.

