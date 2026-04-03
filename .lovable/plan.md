

## Plan: Desactivar sucursal + Pantalla de bienvenida

### 1. Botón "Desactivar/Activar" sucursal en `SucursalTabContent.tsx`

En la sección "Información de la sucursal", al lado del botón "Editar", agregar un botón que permita activar/desactivar la sucursal:

- Si la sucursal está activa: botón "Desactivar" con `variant="outline"` y estilo destructivo
- Si está inactiva: botón "Activar" con `variant="default"`
- Al presionar, mostrar un `AlertDialog` de confirmación (siguiendo el patrón de diseño existente)
- La acción ejecuta `supabase.from('sucursales').update({ activa: !sucursal.activa })` y llama `onSucursalUpdated()`

Cuando la sucursal está inactiva, las secciones de Equipo, Catálogo de servicios y Gestión de turnos se envuelven en un contenedor con `opacity-50 pointer-events-none` y se muestra un banner arriba de cada una (o uno solo arriba de las tres) indicando: "Esta sucursal está desactivada. Activala nuevamente para gestionar estas secciones."

**Nota**: `MiNegocioPanel` ya fetch sucursales sin filtrar por `activa` (línea 63), así que las inactivas ya aparecen en las tabs.

### 2. Pantalla de bienvenida en `Index.tsx`

El problema actual: cuando el usuario inicia sesión, los roles se cargan asincrónicamente. Durante ese breve periodo, `roles` es un array vacío, lo que hace que `getDefaultTab()` retorne `'no-access'` y se muestre el mensaje hostil "Sin acceso".

**Solución**: Reemplazar la pantalla de "Sin acceso" por una pantalla de bienvenida con el nombre "Scissors":

- Logo/nombre de la app "Scissors" con un icono de tijeras
- Mensaje de bienvenida amigable
- Si `roles.length === 0` (aún no se cargaron o el usuario realmente no tiene roles): mostrar la pantalla de bienvenida con un spinner sutil y texto como "Preparando tu espacio de trabajo..."
- Si `hasNoAccess` (tiene rol 'otros'): mostrar un mensaje diferente indicando que debe contactar al dueño

Esto distingue entre "cargando roles" y "sin permisos reales".

### Archivos a modificar

- **`src/components/SucursalTabContent.tsx`**: Agregar botón desactivar/activar con AlertDialog, y overlay de inhabilitación sobre las secciones cuando `sucursal.activa === false`
- **`src/pages/Index.tsx`**: Reemplazar la pantalla "no-access" por una pantalla de bienvenida diferenciada

