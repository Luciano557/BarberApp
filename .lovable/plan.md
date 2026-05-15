## Objetivo

En el paso "Datos" de la reserva, agregar arriba una opción **"¿Ya estás registrado? Ingresá tu teléfono"** que busque el cliente por teléfono dentro de la organización. Si existe, mostrar su nombre para que confirme y continúe directo a la confirmación. Debajo queda el formulario completo para registrarse por primera vez.

## Flujo UX

```text
Paso "Datos"
├─ [Bloque superior] ¿Ya estás registrado?
│   - Selector país + input teléfono
│   - Botón "Buscar mis datos"
│   → si encuentra: muestra "Hola, {Nombre Apellido}" + botón "Sí, soy yo, continuar"
│                    (también botón "No soy yo")
│   → si no encuentra: aviso "No encontramos ese teléfono. Registrate abajo."
│
└─ [Separador "o registrate"]
└─ [Formulario completo] Nombre, Apellido, Teléfono, Email, Fecha nac.
    Botón "Continuar"
```

Al confirmar la identidad se arma el `ClienteData` con los datos del registro existente (nombre, apellido, teléfono, email, birth_date) y se avanza al paso de confirmación. La lógica de `validate-turno` no cambia: igual reutiliza al cliente por teléfono.

## Cambios técnicos

### 1. Nueva edge function `lookup-cliente-by-phone` (`verify_jwt = false`)
- Input: `{ organization_id, telefono }`
- Normaliza el teléfono igual que `validate-turno`
- Busca en `clientes` por `organization_id` + `telefono` + `eliminado=false`
- Devuelve `{ found: true, cliente: { nombre, apellido, telefono, email, birth_date } }` o `{ found: false }`
- No devuelve UUIDs ni datos sensibles innecesarios

Registrar en `supabase/config.toml` con `verify_jwt = false`.

### 2. `src/components/reservar/DatosClienteStep.tsx`
- Agregar bloque superior con selector de país + input teléfono + botón "Buscar mis datos"
- Estado local: `lookupPhone`, `lookupLoading`, `matched: ClienteData | null`, `notFound: boolean`
- Al hacer match: card sobria mostrando "Hola, {Nombre Apellido}" + "Sí, soy yo, continuar" / "No soy yo"
- "Sí, soy yo" → `onSubmit(matched)` y avanza
- "No soy yo" / no encontrado → mantiene visible el formulario de registro debajo
- Recibir `organizationId` por props (pasarlo desde `BookingStepper`)
- Separador visual "o registrate por primera vez" entre los dos bloques

### 3. `src/components/reservar/BookingStepper.tsx`
- Pasar `organizationId={orgData.organization.id}` a `<DatosClienteStep />`

## Lo que NO se toca

- `validate-turno`, `cancel-turno`, `reschedule-turno`, `get-my-turnos-by-phone`
- RLS, PIN, lógica de match/overwrite de clientes
- Formulario de registro existente (queda igual, solo se ubica debajo del bloque de lookup)
- Tema, branding ni estructura de pasos (siguen siendo 6)

## Notas de marca / UX Vittro

- Copy claro y directo: "¿Ya reservaste antes? Ingresá tu teléfono"
- Sin emojis, iconos sobrios (lucide)
- Usar tokens semánticos (`muted`, `border`, `primary`)
- Feedback con `sonner` y estados vacíos explicados
