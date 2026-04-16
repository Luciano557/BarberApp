

## Plan: Add daily turnos viewer to "Cobrar" panel

### What it does

Adds a read-only daily appointments section at the top of the `PaymentRegistration` component. Shows turnos for one day at a time with back/forward arrows to navigate between days (same UX pattern as the existing week navigation but for single days).

### New component: `src/components/DailyTurnosViewer.tsx`

A self-contained, read-only component that:
- Receives `sucursalId` and `organizationId` from context (via `useSucursal` and `useOrganization`)
- Fetches turnos for a single date from `turnos` table (reuses same query pattern as `AgendaViewer`)
- Fetches servicios map for display names
- Shows current date with left/right `ChevronLeft`/`ChevronRight` arrows (like existing week navigation)
- Displays each turno as a compact card: time, client name, barber, service, status badge
- No cancel, reassign, or edit actions — purely read-only
- Shows empty state when no turnos for the day
- Defaults to today

### Changes to `PaymentRegistration.tsx`

- Import and render `<DailyTurnosViewer />` at the top of the component, before the step flow
- No changes to the payment flow logic

### Files changed

| File | Action |
|---|---|
| `src/components/DailyTurnosViewer.tsx` | **New** — read-only daily turnos viewer |
| `src/components/PaymentRegistration.tsx` | Add `<DailyTurnosViewer />` before the step flow |

### No database or permission changes needed

The turnos query already works with existing RLS policies. The component uses the current sucursal from `SucursalContext`.

