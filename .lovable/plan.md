

## Plan: Move "Gestión de Turnos y Agenda" to a new sidebar panel

### What changes

1. **New panel component `src/components/TurnosAgendaPanel.tsx`**
   - Reuses the same multi-sucursal tab pattern from `MiNegocioPanel` (fetches sucursales, filters by manager assignment, tabs navigation)
   - Each tab renders `AgendaManagement` for that sucursal with its barbers
   - Owner/GM see all sucursales; Manager sees only assigned ones

2. **Add permission flag in `AuthContext.tsx`**
   - Add `canViewTurnosAgenda` = `isOwner || isGeneralManager || isManager` (same as `canViewMiNegocio`)

3. **Add sidebar entry in `AppSidebar.tsx`**
   - New nav item `{ id: 'turnos-agenda', label: 'Turnos y Agenda', icon: CalendarClock }` visible when `canViewTurnosAgenda`
   - Positioned after "Tareas" and before "Mi Negocio"

4. **Register tab in `Index.tsx`**
   - Add `turnos-agenda` tab rendering `TurnosAgendaPanel` wrapped in `PinProtectedSection`
   - Add permission guard in the `useEffect` block

5. **Remove from `SucursalTabContent.tsx`**
   - Delete the `AgendaManagement` import and the block at lines 249–256
   - Remove unused `AgendaManagement` import

### Files changed

| File | Action |
|---|---|
| `src/components/TurnosAgendaPanel.tsx` | **New** — panel with sucursal tabs + AgendaManagement |
| `src/contexts/AuthContext.tsx` | Add `canViewTurnosAgenda` permission |
| `src/components/AppSidebar.tsx` | Add nav item for turnos-agenda |
| `src/pages/Index.tsx` | Add tab + permission guard |
| `src/components/SucursalTabContent.tsx` | Remove AgendaManagement section |

### No changes to
- Business logic, data structures, AgendaManagement internals, or any other existing flows

