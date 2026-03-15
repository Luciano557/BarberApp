
# Multi-Organización y Sucursales — Estado

## ✅ Fase 1: Base de datos (COMPLETADA)
- Tabla `sucursales` creada con RLS (owner full, manager/barber SELECT por membresía)
- Tabla `user_sucursales` creada para membresía por sucursal
- `sucursal_id` agregado a: barberos, venta, ingresos, ingresos_items, Egresos, pagos_sueldos, inversiones, deudas, tareas, ReportesMensuales
- `default_sucursal_id` agregado a profiles
- `handle_new_user` actualizado para auto-crear sucursal "Casa Central"
- Datos existentes backfilleados con sucursal default
- Función helper `get_user_sucursal_ids`

## ✅ Fase 2: Frontend — Contexto + Selector (COMPLETADA)
- `SucursalContext` con soporte para "Todas" (dueño) y sucursal fija (encargado/barbero)
- `SucursalSelector` integrado en sidebar
- Hooks actualizados: useTransactions, useCashClosing, useGastos, useInversiones, useDeudas, useTareas, useSupabaseData

## 📋 Fase 3: "Mi Negocio" como sección independiente (PENDIENTE)
- Nuevo tab en sidebar (solo dueño)
- CRUD de sucursales, asignación de encargados
- Mover gestión de usuarios desde Config

## 📋 Fase 4: Reporting consolidado (PENDIENTE)
- Vista "Todas las sucursales": KPIs globales, ranking
- Vista "Sucursal X": detalle local
