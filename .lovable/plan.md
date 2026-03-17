
# Multi-Organización y Sucursales — Estado

## ✅ Fase 1: Base de datos (COMPLETADA)
- Tabla `sucursales` y `user_sucursales` con RLS
- `sucursal_id` en todas las tablas operativas
- `handle_new_user` auto-crea sucursal "Casa Central"
- Datos existentes backfilleados

## ✅ Fase 2: Frontend — Contexto + Selector (COMPLETADA)
- `SucursalContext` con modo "Todas" para dueños
- `SucursalSelector` en sidebar
- Hooks actualizados con filtro por sucursal

## ✅ Fase 3: "Mi Negocio" como sección independiente (COMPLETADA)
- Nuevo tab "Mi Negocio" en sidebar (solo dueño)
- Sub-secciones: Información, Sucursales (CRUD + asignación de usuarios), Usuarios, Plan
- Configuración simplificada: Staff, Cobrar, PIN, Tareas

## ✅ Fase 4: Reporting por sucursal (COMPLETADA)
- EstadisticasPanel filtrado por sucursal
- DailySummary filtrado por sucursal
- SueldosPanel filtrado por sucursal (ingresos, pagos, inserts)

## ✅ Fase 5: Aislamiento de datos por sucursal para Encargados de Local (COMPLETADA)
- Barberos filtrados por `sucursal_id` en `useSupabaseData`
- Re-fetch automático al cambiar de sucursal
- `SucursalSelector` oculto para managers (encargados de local)
- `SucursalContext` bloquea cambio de sucursal para no-owner/GM
- RLS de `barberos` actualizado: managers solo ven barberos de sus sucursales asignadas
