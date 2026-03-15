

# Nuevo rol "Encargado General" + Renombrar "Encargado" a "Encargado de Local"

## Resumen

El sistema actual tiene 3 roles: `owner`, `manager`, `barber`. Se necesita un cuarto rol `general_manager` (Encargado General) que tenga los mismos permisos que el dueño (ver todas las sucursales, gestionar configuración, etc.) pero sin ser dueño. El rol `manager` actual pasa a llamarse "Encargado de Local" y queda restringido a operar solo en su sucursal asignada (cobros, cierres, resumen local).

## Cambios

### 1. Base de datos — Agregar valor al enum `app_role`

```sql
ALTER TYPE public.app_role ADD VALUE 'general_manager';
```

No se necesitan cambios en RLS porque las políticas ya usan `has_role()`. Solo hay que agregar `general_manager` a las mismas condiciones donde aparece `owner`.

### 2. Actualizar políticas RLS

Todas las políticas que hoy dicen `has_role(auth.uid(), 'owner')` deben incluir también `has_role(auth.uid(), 'general_manager')`. Esto aplica a:
- `barberos` (owner full access)
- `organizations` (owner update)
- `profiles` (owner update/view org)
- `user_roles` (owner CRUD)
- `user_sucursales` (owner full access)
- `sucursales` (owner full access)
- `anulaciones_cierre` (owner insert/view — ya incluye manager)
- Tablas donde owner tiene DELETE exclusivo (`ingresos`)

### 3. AuthContext — Agregar `isGeneralManager`

```typescript
export type AppRole = 'owner' | 'general_manager' | 'manager' | 'barber';

const isGeneralManager = roles.includes('general_manager');

// Permisos actualizados:
const canManagePayments = isOwner || isGeneralManager || isManager;
const canManageConfig = isOwner || isGeneralManager || isManager;
const canManageBarbers = isOwner || isGeneralManager;
const canManageUsers = isOwner || isGeneralManager;
const canViewAllClosings = isOwner || isGeneralManager || isManager;
```

### 4. SucursalContext — General Manager ve todas las sucursales

Actualmente solo `isOwner` puede ver "Todas las sucursales". Agregar `isGeneralManager` a esa lógica.

### 5. Sidebar y UI — Labels y permisos

- `general_manager` → badge "Enc. General", acceso a "Mi Negocio"
- `manager` → badge "Enc. Local", sin acceso a "Mi Negocio", restringido a su sucursal
- El selector de sucursal muestra opción "Todas" para owner y general_manager

### 6. UserManagement e InviteUserDialog

- Agregar opción "Encargado General" en el selector de roles
- Labels: `owner`→"Dueño", `general_manager`→"Encargado General", `manager`→"Encargado de Local", `barber`→"Barbero"

### 7. Manager (Encargado de Local) — Restricción a sucursal

El `manager` actual ya está restringido por sucursal en RLS para `sucursales`. Se debe verificar que las queries operativas (ventas, ingresos, etc.) filtren por `sucursal_id` cuando el usuario es manager, lo cual ya ocurre via el `SucursalContext` que fija la sucursal asignada para no-owners.

## Archivos a modificar

- **Migración SQL**: nuevo valor de enum + actualización de ~15 políticas RLS
- `src/contexts/AuthContext.tsx`: nuevo tipo, nuevo flag, permisos actualizados
- `src/contexts/SucursalContext.tsx`: general_manager ve todas
- `src/components/AppSidebar.tsx`: badge y acceso Mi Negocio
- `src/components/SucursalSelector.tsx`: selector para general_manager
- `src/components/UserManagement.tsx`: labels y selector de rol
- `src/components/InviteUserDialog.tsx`: opción general_manager
- `src/components/MiNegocioPanel.tsx`: acceso para general_manager
- `src/components/DailySummary.tsx`: permisos void/backfill

