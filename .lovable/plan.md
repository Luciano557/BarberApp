

## Resumen

4 cambios: renombrar "Encargado de Local" a "Encargado de Sucursal", ajustar permisos del manager (sin Config, Mi Negocio limitado a su sucursal), solicitar sucursal al asignar rol manager, y abrir Mi Negocio en la pestaña de la sucursal seleccionada en el panel.

## 1. Renombrar "Encargado de Local" → "Encargado de Sucursal"

Cambios de texto en:
- `EquipoUnificado.tsx` línea 32: `'Encargado de Sucursal'` (ya está hecho)
- `AppSidebar.tsx` línea 42: cambiar `'Enc. Local'` → `'Enc. Sucursal'`
- `InviteUserDialog.tsx` línea 303: cambiar `"Encargado de Local"` → `"Encargado de Sucursal"`
- `invite-user/index.ts` línea 159: cambiar `"Encargado de Local"` → `"Encargado de Sucursal"`

## 2. Ajustar permisos del Encargado de Sucursal (manager)

**En `AuthContext.tsx`**:
- `canManageConfig`: quitar `isManager` → solo `isOwner || isGeneralManager`
- Agregar nuevo permiso `canViewMiNegocio`: `isOwner || isGeneralManager || isManager`

**En `AppSidebar.tsx`**:
- Cambiar nav item "Configuración": solo mostrar si `canManageConfig` (que ahora excluye manager)
- Cambiar nav item "Mi Negocio": mostrar si `canViewMiNegocio` (nuevo permiso que incluye manager)
- Finanzas: mantener con `canManageConfig` (excluye manager) o crear permiso separado — dado que el usuario dijo "todo menos Configuración", Finanzas debería quedarse visible para el manager. Confirmo: `canManageConfig` actualmente controla tanto Config como Finanzas. Necesitamos separar: crear `canViewFinanzas = isOwner || isGeneralManager || isManager` y dejar `canManageConfig = isOwner || isGeneralManager`.

**En `Index.tsx`**:
- Tab `mi-negocio`: cambiar condición de `isOwner` a `canViewMiNegocio`
- Tab `config`: mantener con `canManageConfig` (ahora solo owner/GM)
- Tab `finanzas`: usar `canViewFinanzas`

## 3. Manager en Mi Negocio: solo su sucursal asignada

**En `MiNegocioPanel.tsx`**:
- Importar `useAuth` y detectar si es `isManager` (sin ser owner/GM)
- Si es manager: filtrar `allSucursales` para mostrar solo las sucursales asignadas al usuario (query `user_sucursales` por `user_id`)
- Ocultar botón "Nueva sucursal" para managers
- Si solo tiene 1 sucursal (caso típico del manager), no mostrar tabs, ir directo al contenido

## 4. Solicitar sucursal al asignar rol "manager"

**En `EquipoUnificado.tsx`** (formulario de roles):
- Cuando se activa el checkbox de `manager` en la vista de detalle, mostrar un `Select` para elegir la sucursal asignada
- Al confirmar, además de insertar el rol en `user_roles`, insertar/actualizar en `user_sucursales` con la sucursal elegida
- Props: pasar lista de sucursales disponibles al componente

**En `InviteUserDialog.tsx`**:
- Cuando se selecciona rol `manager`, mostrar un campo adicional de selección de sucursal
- Pasar `sucursalId` al edge function para que cree el registro en `user_sucursales`

**En `invite-user/index.ts`**:
- Aceptar nuevo campo opcional `sucursalId` en el request
- Si viene `sucursalId`, insertar en `user_sucursales` tras crear el usuario

## 5. Mi Negocio abre en la pestaña de la sucursal del panel

**En `MiNegocioPanel.tsx`**:
- Importar `useSucursal` y obtener `currentSucursal`
- Cambiar `defaultValue` del `Tabs` de `allSucursales[0]?.id` a `currentSucursal?.id || allSucursales[0]?.id`
- Si `currentSucursal` está seteada y existe en la lista, usar su id como tab activa inicial

## Archivos a modificar

1. **`src/contexts/AuthContext.tsx`** — nuevos permisos `canViewMiNegocio`, `canViewFinanzas`; `canManageConfig` sin manager
2. **`src/components/AppSidebar.tsx`** — renombrar badge, actualizar nav items con nuevos permisos
3. **`src/pages/Index.tsx`** — usar nuevos permisos para tabs
4. **`src/components/MiNegocioPanel.tsx`** — filtrar sucursales para manager, abrir en pestaña de sucursal actual
5. **`src/components/config/EquipoUnificado.tsx`** — pedir sucursal al asignar rol manager + pasar sucursales como prop
6. **`src/components/InviteUserDialog.tsx`** — campo sucursal para rol manager, renombrar texto
7. **`supabase/functions/invite-user/index.ts`** — aceptar `sucursalId`, insertar en `user_sucursales`
8. **`src/components/SucursalTabContent.tsx`** — pasar sucursales a EquipoUnificado (nueva prop)

