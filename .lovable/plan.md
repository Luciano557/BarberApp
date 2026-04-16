

## Plan: UI improvements to Turnos y Agenda panel

### Changes summary

No database changes needed. The `turnos.barbero_id` column already exists and supports UPDATE for reassignment.

---

### 1. Remove duplicate header in `AgendaManagement.tsx`

Remove lines 17–26 (the icon + title + subtitle block). Keep only the sections inside, and change from `Accordion` to plain stacked sections (no collapsibles).

Reorder sections:
1. Configuración General (`AgendaConfigSection`)
2. Visualizar agenda (`AgendaViewer`)
3. Gestionar ausencias y cierres (`BloqueosSection`)
4. Horarios de trabajo (`HorariosTrabajoSection`)

Each section wrapped in a titled `div` with a heading, rendered fully expanded (no accordion).

### 2. Rename "Buffer después" → "Tiempo de espera" in `AgendaConfigSection.tsx`

Change the label in the `fields` array from `'Buffer después'` to `'Tiempo de espera'`.

### 3. Rename "Rango" → "Agregar un rango horario" in `HorariosTrabajoSection.tsx`

In the `ScheduleGrid` component, change the button text from `Rango` to `Agregar un rango horario`.

### 4. Add subtitle to `BloqueosSection.tsx`

Below the card title "Gestionar ausencias y cierres", add a descriptive subtitle:
`"Registrá días o franjas horarias en las que la sucursal o un barbero no estarán disponibles para recibir turnos."`

### 5. Add barber reassignment to `AgendaViewer.tsx`

In each turno row, add a barber reassignment dropdown (small `Select`) that:
- Shows active barbers from the sucursal
- On change, calls `supabase.from('turnos').update({ barbero_id: newId }).eq('id', turnoId)`
- Shows a toast on success and refreshes the list
- Only visible for turnos with status `pendiente` or `confirmado`

### Files changed

| File | Action |
|---|---|
| `src/components/config/AgendaManagement.tsx` | Remove duplicate header, replace Accordion with stacked sections, reorder |
| `src/components/config/AgendaConfigSection.tsx` | Rename "Buffer después" → "Tiempo de espera" |
| `src/components/config/HorariosTrabajoSection.tsx` | Rename button "Rango" → "Agregar un rango horario" |
| `src/components/config/BloqueosSection.tsx` | Add descriptive subtitle |
| `src/components/config/AgendaViewer.tsx` | Add barber reassignment Select per turno row |

