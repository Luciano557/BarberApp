

## Roles múltiples por empleado y filtro de "Cobrar" por rol barbero

### Problema actual
- El sistema asigna UN solo cargo por empleado. Al cambiar cargo, borra los anteriores e inserta el nuevo.
- Agus Community tiene cargo "otros" pero su `rol_equipo` en la tabla `barberos` puede no haberse sincronizado correctamente, por lo que sigue apareciendo en Cobrar.
- Tomás Basante es encargado de sucursal Y barbero, pero solo puede tener un cargo.

### Solución

Separar dos conceptos:
1. **Cargo(s) del sistema** (`user_roles`): define permisos (owner, general_manager, manager, barber, otros). Un empleado puede tener VARIOS.
2. **`rol_equipo`** en tabla `barberos`: determina si aparece en Cobrar. Se calcula automáticamente: si tiene el cargo "barber" entre sus roles → `rol_equipo = 'barbero'`, si no → `'otros'`.

### Cambios por archivo

**1. `src/components/config/EquipoUnificado.tsx`**
- **Selector de cargo**: Cambiar de single-select a multi-select con checkboxes. Roles disponibles: Encargado General, Encargado de Sucursal, Barbero, Otros.
- **`handleChangeRole`**: En vez de borrar todos los roles y poner uno, manejar un array de roles seleccionados. Insertar/borrar según diferencia.
- **Sincronización automática de `rol_equipo`**: Si los roles seleccionados incluyen `'barber'` → `rol_equipo = 'barbero'`. Si no → `'otros'`.
- **Mostrar badges múltiples**: En vez de mostrar solo el "highest role", mostrar todos los badges de roles asignados.
- **PIN e Invitar**: Mostrar estos botones si el empleado tiene AL MENOS un rol que no sea 'otros' (o sea, si tiene barber, manager, etc.).
- **Form**: El selector de cargo en el formulario de agregar/editar también pasa a ser multi-select.

**2. `src/components/config/EquipoUnificado.tsx` — funciones auxiliares**
- `getBarberRole` → `getBarberRoles` (retorna array).
- `getUserRoles` ya retorna array, se mantiene.
- Sorting: usar el rol de mayor jerarquía para ordenar, igual que ahora.

**3. `src/pages/Index.tsx`** (sin cambios necesarios)
- Ya filtra con `b.teamRole !== 'otros'`, y la sincronización automática de `rol_equipo` se encarga del resto.

**4. No se necesita migración de base de datos**
- La tabla `user_roles` ya soporta múltiples filas por usuario (tiene `unique(user_id, role)` pero permite múltiples roles distintos).
- El campo `rol_equipo` en `barberos` ya existe.

### Flujo de ejemplo
- Tomás Basante: se le asignan los cargos "Encargado de Sucursal" + "Barbero" → `rol_equipo = 'barbero'` → aparece en Cobrar.
- Agus Community: se le asigna solo "Otros" → `rol_equipo = 'otros'` → NO aparece en Cobrar.

### Resultado
- Cada empleado puede tener múltiples cargos simultáneos.
- Solo los que tengan "Barbero" entre sus cargos aparecen en el flujo de cobro.
- PIN e Invitar se muestran si tiene algún rol con acceso al sistema.

