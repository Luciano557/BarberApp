## Objetivo

Corregir tres problemas relacionados:

1. El encargado de sucursal (manager) puede crear o editar campos estructurales de servicios desde la UI, pero la operación termina rompiendo silenciosamente.
2. Mi Negocio › Sucursal › Servicios y Cobrar muestran listas distintas para la misma sucursal.
3. El barbero no debe entrar a Cobrar; un usuario con cargos manager + barber sí.

Sin tocar ventas históricas, agenda, caja, comisiones ni multi-tenant.

## Cambios

### 1. Backend (ya aplicado en migración)

- Se quita la política ALL sobre `servicios` que daba acceso al manager.
- Se agregan políticas separadas INSERT / UPDATE / DELETE en `servicios` solo para `owner` y `general_manager`.
- SELECT global para la organización se mantiene.
- Para precio y activo por sucursal se siguen usando las funciones existentes `set_servicio_sucursal_precio` y `set_servicio_sucursal_activo`, que ya validan owner, general_manager y manager (manager limitado a su única sucursal asignada). Misma RPC para los tres cargos: no hace falta una función nueva.

### 2. `ServicesConfig.tsx`

- Nuevas props opcionales: `canCreate` (default `true`) y `canEditStructure` (default `true`).
- Si `canCreate === false`: ocultar el botón "Agregar servicio".
- Si `canEditStructure === false`: nombre, duración y línea quedan en modo lectura (input deshabilitado o no editable). Solo `CurrencyInput` (precio) y el toggle de activo siguen editables.
- Mostrar un texto auxiliar breve cuando el manager no pueda editar estructura, explicando qué puede hacer.

### 3. `CobrarConfig.tsx`

- Pasar `canCreate` y `canEditStructure` hacia `ServicesConfig` con la misma lógica que en Mi Negocio.

### 4. `SucursalTabContent.tsx`

- Calcular permisos a partir de `useAuth()`:
  - `canCreate = isOwner || isGeneralManager`
  - `canEditStructure = isOwner || isGeneralManager`
- Pasar ambas props a `ServicesConfig`.

### 5. `MiNegocioGeneralTabContent.tsx`

- Pasar `canCreate=true` y `canEditStructure=true` (tab solo visible para owner/gm, no cambia comportamiento).

### 6. `MiNegocioPanel.tsx` — unificación de fuente de datos

- Reemplazar `getServicesForSucursal(sucursalId) = allServices.filter(s => s.sucursalId === sucursalId)` por la misma lista enriquecida que usa Cobrar (`allServices` ya viene con `servicios_sucursales` resuelto para la sucursal activa en `useSupabaseData`).
- Idem para extras.
- Para evitar mostrar datos de otra sucursal mientras se cambia de tab, pasar `currentSucursal?.id === s.id ? allServices : []` a `SucursalTabContent`. El handler de tab ya hace `setCurrentSucursal(value)`, así que la lista se refresca automáticamente.

### 7. Cobrar — bloqueo de servicios sin precio

- No se ocultan: siguen visibles con etiqueta "Precio pendiente".
- `PaymentRegistration.tsx` ya bloquea la selección con un toast claro. Se confirma que el comportamiento se mantiene.

### 8. Acceso al módulo Cobrar

- Confirmado: `AppSidebar` y `Index.tsx` ya gatean por `canManagePayments` (owner / general_manager / manager). Un usuario con manager + barber pasa la condición.
- No se modifica nada en este punto.

## Detalles técnicos

- `set_servicio_sucursal_precio(_id, _precio)` y `set_servicio_sucursal_activo(_id, _activo)` ya están definidas como `SECURITY DEFINER` con `_assert_can_write_sucursal_catalog`, que valida organización, sucursal y cargo. Manager solo puede operar sobre su única sucursal asignada.
- `useSupabaseData.updateService` ya canaliza precio y activo por estas RPCs cuando hay `sucursalId`.
- Tras quitar la política ALL, cualquier intento del frontend de hacer `update servicios` con campos estructurales desde manager devolverá error de RLS. Por eso el bloqueo en UI (`canEditStructure`) es la primera línea de defensa.

## Qué no se toca

- `user_roles`, `roles_equipo`, `rol_equipo`, `user_sucursales`, `profiles`, `barberos`.
- Historial de ventas, ingresos, cierres, comisiones, agenda.
- Multi-tenant ni RLS de otras tablas.

## Verificación

- Owner / GM: pueden crear, editar nombre/duración/línea, precio y activo en Mi Negocio y en Cobrar.
- Manager: en Mi Negocio › Servicios solo puede editar precio y activo de los servicios de su sucursal. Inputs estructurales bloqueados, sin botón "Agregar".
- Manager: en Cobrar ve los mismos servicios que en Mi Negocio › Sucursal › Servicios. "Precio pendiente" visible pero no cobrable.
- Barber puro: no entra a Cobrar.
- Manager + barber: entra a Cobrar normalmente.
