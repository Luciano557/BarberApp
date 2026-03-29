

## Verificacion y correcciones del sistema de roles multiples

### Problemas encontrados

**1. Usuarios con solo rol "Otros" pueden ver Resumen y Tareas**
Actualmente, las tabs "Resumen" y "Tareas" se muestran siempre en el sidebar y en Index.tsx sin ninguna restriccion de rol. Un usuario con solo el rol "otros" puede ver ambas secciones, cuando no deberia ver nada.

**2. Sidebar muestra solo el badge del rol mas alto**
`getRoleBadge()` en `AppSidebar.tsx` retorna un unico badge basado en prioridad. Con multi-roles, deberia mostrar todos los roles asignados (ej: "Enc. Local" + "Barbero").

**3. No hay pantalla de "sin acceso" para rol "otros"**
Si un usuario con solo "otros" inicia sesion, deberia ver un mensaje indicando que no tiene permisos, en lugar de una interfaz vacia.

### Plan de cambios

**1. AuthContext — agregar `hasNoAccess` computed (`src/contexts/AuthContext.tsx`)**
- Agregar: `const hasNoAccess = roles.length > 0 && roles.every(r => r === 'otros');`
- Agregar: `canViewResumen` = cualquier rol que no sea solo "otros" (owner, GM, manager, barber)
- Agregar: `canViewTareas` = cualquier rol que no sea solo "otros"
- Exportar estos valores en el context

**2. AppSidebar — filtrar tabs y mostrar multi-badges (`src/components/AppSidebar.tsx`)**
- Condicionar "Resumen" a `canViewResumen` (ya no se muestra siempre)
- Condicionar "Tareas" a `canViewTareas`
- Cambiar `getRoleBadge()` a `getRoleBadges()` que retorne un array de badges para todos los roles del usuario
- Si el usuario tiene solo "otros", no mostrar ninguna nav item

**3. Index.tsx — mostrar mensaje de "sin acceso" para rol otros**
- Si `hasNoAccess` es true, mostrar un mensaje claro: "No tenes permisos para acceder a esta seccion"
- Condicionar tabs Resumen y Tareas con los nuevos permisos
- Agregar redirect al detectar `hasNoAccess`

**4. Index.tsx — redirect si tab activa no tiene permisos**
- Actualizar el `useEffect` para cubrir los casos de resumen y tareas cuando el usuario pierde acceso

### Archivos a modificar
1. `src/contexts/AuthContext.tsx` — agregar `hasNoAccess`, `canViewResumen`, `canViewTareas`
2. `src/components/AppSidebar.tsx` — filtrar Resumen/Tareas, multi-badges
3. `src/pages/Index.tsx` — pantalla "sin acceso" para "otros", condicionar tabs

### Sin cambios necesarios
- La logica de multi-roles en `EquipoUnificado.tsx` funciona correctamente
- La sincronizacion de `rol_equipo` con `barberos` funciona
- El filtro de `teamRole !== 'otros'` en `PaymentRegistration` funciona
- PIN e Invitar ocultos para "otros" funciona
- La migracion de `app_role` enum con 'otros' esta aplicada
- RLS policies existentes son compatibles con multi-roles (usan `has_role` que chequea existencia)

