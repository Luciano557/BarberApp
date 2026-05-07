## Cambio UX selector de cargos en Equipo

Reemplazar el selector de checkboxes planos por tarjetas seleccionables en `src/components/config/EquipoUnificado.tsx`. Cambio puramente visual y de interacción. No se tocan edge functions, DB, migraciones, `roles_equipo`, `rol_equipo`, `user_roles`, `user_sucursales`, lógica de permisos, `handleFormSave`, `submitWithConflictHandling`, `handleChangeRoles`, `getDisplayRoles`, persistencia, diálogos de reemplazo de Encargado, sección Acceso al sistema, ni `ExtrasCompensacion`.

Modelo interno se mantiene: `localData.roles: AppRole[]`.

### Alcance

Único archivo: `src/components/config/EquipoUnificado.tsx`.

### 1. Helpers nuevos (módulo, junto a `enforceRoleRules`)

- `getHierarchicalRole(roles): 'owner' | 'general_manager' | 'manager' | null`
- `hasOperationalBarber(roles): boolean`
- `normalizeRoles(roles): AppRole[]`
  - Si tiene `owner` → quita `manager`, `general_manager`, `otros`. Permite `owner` o `owner+barber`.
  - Si tiene cualquier rol distinto de `otros` → quita `otros`.
  - Nunca permite `manager + general_manager` (los toggles ya lo evitan).
  - Si queda vacío → `['otros']`.
- `toggleHierarchical(roles, target)` con `target ∈ {'general_manager','manager'}`:
  - Si `target` ya está activo → lo quita.
  - Si no → lo agrega, quita el otro jerárquico, quita `otros`, conserva `barber` si estaba.
  - Devuelve `normalizeRoles`.
- `toggleBarber(roles)`:
  - Si `barber` activo → lo quita.
  - Si no → lo agrega, quita `otros`.
  - Devuelve `normalizeRoles`.

`enforceRoleRules` no se elimina; el form deja de usarla y pasa a usar los nuevos helpers. La card del integrante también deja de usarla (ver punto 4).

### 2. Form (`StaffForm`, líneas ~1151-1181)

Reemplazar el bloque actual `Cargo(s) *` por dos secciones de tarjetas más una vista previa.

**Bloque informativo de owner** (renderizado solo si `localData.roles.includes('owner')`, encima de las secciones):
- Texto: "Este integrante es Dueño del negocio. Este cargo no se puede modificar desde Equipo."
- Estilo sobrio (fondo `muted`, borde `border`, ícono de owner).

**A) Cargo jerárquico**
- Título: "Cargo jerárquico".
- Descripción: "Define responsabilidades de gestión dentro del negocio."
- Dos tarjetas en grid (1 col mobile, 2 cols ≥sm):
  - "Encargado General" (`general_manager`) — descripción: "Acceso amplio a gestión y configuración."
  - "Encargado de Sucursal" (`manager`) — descripción: "Gestiona la operación de esta sucursal."
- Selección mutuamente exclusiva. Tocar la activa la desactiva → puede dejar al integrante sin cargo jerárquico.
- Sin tarjeta "Sin cargo jerárquico".
- Si está seleccionada `general_manager`, la tarjeta `manager` se muestra atenuada con texto auxiliar: "Reemplaza Encargado General." (sigue clickeable; tocarla cambia a `manager`).
- Análogo si está seleccionada `manager`: la tarjeta `general_manager` muestra "Reemplaza Encargado de Sucursal."
- Si `localData.roles.includes('owner')`: ambas tarjetas se muestran deshabilitadas (no clickeables) con texto: "No disponible para dueños."

**B) Trabajo operativo**
- Título: "Trabajo operativo".
- Descripción: "Indica si esta persona también trabaja realizando servicios."
- Una tarjeta: "Barbero" (`barber`) — descripción: "Puede recibir turnos, ventas y comisiones."
- Toggle simple. Disponible siempre, incluso para owners.

**Vista previa** debajo de las tarjetas:
- Texto: "Este integrante quedará como:"
- Renderiza badges según `localData.roles` usando `getRoleLabel` + `getRoleIcon` (y `getRoleBadgeVariant` si existe). Concatenados visualmente con un separador "+".
- Casos cubiertos: `['manager','barber']` → "Encargado de Sucursal + Barbero", `['otros']` → "Otros", `['owner','barber']` → "Dueño + Barbero", etc.

### 3. Componente local `RoleCard`

Componente inline definido dentro del archivo (no archivo nuevo). Render como `<button type="button">`.

Props: `icon`, `title`, `description`, `selected`, `state` (`'normal' | 'replaceable' | 'disabled'`), `replaceableLabel?`, `disabledLabel?`, `onClick`.

Estados visuales (tokens semánticos, sin emojis, sin colores hardcoded):
- **Seleccionada**: `border-primary bg-primary/5`, título en `font-medium text-foreground`, ícono primario, `Check` visible a la derecha.
- **Reemplazable** (no seleccionada pero tocarla reemplaza al jerárquico actual): `border-border opacity-60`, texto auxiliar en `text-[11px] text-muted-foreground`. Sigue clickeable.
- **Normal no seleccionada**: `border-border bg-background hover:bg-accent/40`.
- **Deshabilitada (owner)**: `border-border bg-muted/40 opacity-50 cursor-not-allowed`, `disabled` real, texto auxiliar.

Layout interno: ícono arriba-izquierda, título, descripción en `text-xs text-muted-foreground`. Padding cómodo, `rounded-lg`, transiciones suaves.

### 4. Card del integrante (líneas ~692-719)

Reemplazar el bloque actual de checkboxes inline por badges visuales no editables:
- Renderizar `getDisplayRoles(barber)` (incluyendo `owner` cuando aplique) como `<Badge variant="secondary">` con `getRoleIcon` + `getRoleLabel`.
- Quitar `Checkbox`, `enforceRoleRules` y `handleChangeRoles` desde la card.
- La edición se hace exclusivamente vía botón Editar existente (que abre `StaffForm`).

### 5. Validación de comisión

En `StaffForm`, cambiar:
```
commissionRequired = isComision && (roles.includes('barber') || roles.includes('manager'))
```
por:
```
commissionRequired = isComision && roles.includes('barber')
```
Un Encargado de Sucursal sin `barber` no requiere comisión obligatoria.

Quitar la condición `localData.roles.length === 0` del `disabled` del botón Guardar (ya nunca puede ocurrir porque `normalizeRoles` garantiza mínimo `['otros']`).

### 6. Lo que NO cambia

- `StaffFormData`, `handleFormSave`, `submitWithConflictHandling`, `handleChangeRoles`, `rolesToRolEquipo`, `getDisplayRoles`, edge functions, llamadas a Supabase, base de datos, migraciones.
- Resto del form: nombre, apellido, teléfono, DNI, dirección, tipo de compensación, comisión, sueldo fijo, día de cobro, botones Guardar/Cancelar.
- `ExtrasCompensacion`, sección "Acceso al sistema", diálogos de reemplazo de Encargado, lógica real de permisos.

### 7. Casos de prueba cubiertos

A: nada → `['otros']`. B: solo Barbero → `['barber']`. C: Encargado Sucursal → `['manager']`. D: Manager+Barbero → `['manager','barber']`. E: GM+Barbero → `['general_manager','barber']`. F: desde `['otros']` selecciona Manager → `['manager']` (no agrega barber). G: desde `['manager']` toca Barbero → `['manager','barber']`. H: desmarca Barbero → `['manager']`. I: desde `['manager']` retoca Manager → `['otros']`. J: card muestra solo badges, edición vía Editar. K: desde `['general_manager','barber']` toca Manager → `['manager','barber']`. L: desde `['manager','barber']` toca GM → `['general_manager','barber']`. M: `['owner','barber']` → vista "Dueño + Barbero", tarjetas jerárquicas deshabilitadas. N: desde `['otros']` toca Barbero → `['barber']`. O: desde `['otros']` toca GM → `['general_manager']`. P: desde `['manager']` retoca Manager → `['otros']`. Q: desde `['manager','barber']` retoca Barbero → `['manager']`. R: desde `['general_manager']` retoca GM → `['otros']`.