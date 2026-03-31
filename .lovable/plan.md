

## Resumen

Renombrar "Resumen" a "Caja" en la navegación, y mover "Estadísticas" y "Sueldos" del sidebar hacia dentro de "Finanzas" como tabs adicionales.

## Plan

### 1. AppSidebar — Renombrar y eliminar items

- Cambiar `{ id: 'resumen', label: 'Resumen', icon: BarChart3 }` → label `'Caja'`
- Eliminar las entradas de `estadisticas` y `sueldos` del array `navItems`
- Eliminar imports no usados (`Wallet`, `TrendingUp`)

### 2. FinanzasPanel — Agregar tabs de Estadísticas y Sueldos

- Agregar dos nuevos tabs: "Estadísticas" y "Sueldos" al `TabsList` (total: 5 tabs)
- Importar `EstadisticasPanel` y `SueldosPanel`
- `FinanzasPanel` necesita recibir `barbers` como prop para pasárselo a `SueldosPanel`
- El `TabsList` con 5 tabs puede necesitar scroll horizontal en mobile — agregar `overflow-x-auto` y `flex-wrap` o scroll

### 3. Index.tsx — Limpiar secciones eliminadas

- Eliminar los bloques `activeTab === 'estadisticas'` y `activeTab === 'sueldos'`
- Pasar `barbers` como prop a `<FinanzasPanel barbers={barbers} />`
- Eliminar imports de `SueldosPanel` y `EstadisticasPanel` (ahora se importan desde FinanzasPanel)

### Detalle técnico

**FinanzasPanel** recibe `barbers` y renderiza 5 tabs:
```
Gastos | Inversiones | Deudas | Estadísticas | Sueldos
```

La protección por PIN se mantiene a nivel de la sección "Finanzas" completa (ya está wrapeado en `PinProtectedSection` en Index.tsx), por lo que Estadísticas y Sueldos quedan protegidos automáticamente.

