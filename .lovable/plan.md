

## Enhanced Plan: Centralize All Colors to CSS Variables (V2)

The existing plan (Steps 1–4) is preserved. Two new steps and one constraint are added. The scope is confirmed by a full codebase scan.

---

### Scan Results Summary

The codebase has **zero** instances of `bg-white`, `text-black`, `text-gray-*`, `border-gray-*`, `text-slate-*`, `bg-slate-*`. These were already cleaned in the previous refactor.

All remaining hardcoded colors fall into two categories:

1. **Status/chart colors** — already covered by existing Steps 1–4 (7 component files)
2. **Data colors** — `ServicesConfig.tsx` LINE_COLORS (user-selectable, stored in DB) and `chart.tsx` Recharts selector overrides (library internals targeting `#ccc` and `#fff`). Both are excluded as justified.

---

### NEW Step 5: Enforce Semantic Color Usage

After completing Steps 1–4 (status + chart token migration), run a final validation pass across ALL `.tsx` files to confirm zero remaining hardcoded Tailwind color utilities.

**Forbidden patterns** (must return zero matches):
- `bg-white`, `bg-black`
- `text-white` (except inside component variants that reference `--*-foreground`)
- `text-gray-*`, `bg-gray-*`, `border-gray-*`
- `text-slate-*`, `bg-slate-*`, `border-slate-*`
- `text-zinc-*`, `bg-zinc-*`, `border-zinc-*`
- `text-green-*`, `bg-green-*`, `border-green-*`
- `text-red-*`, `bg-red-*`, `border-red-*`
- `text-blue-*`, `bg-blue-*`, `border-blue-*`
- `text-amber-*`, `bg-amber-*`, `border-amber-*`
- `text-orange-*`, `bg-orange-*`, `border-orange-*`
- `text-purple-*`, `bg-purple-*`, `border-purple-*`
- `text-yellow-*`, `bg-yellow-*`, `border-yellow-*`
- Hardcoded `hsl(...)` with literal values (not `hsl(var(...))`)

**Allowed exceptions** (documented, not bugs):
- `ServicesConfig.tsx` LINE_COLORS — user-selectable data colors stored in DB
- `chart.tsx` — Recharts CSS selector overrides targeting library-internal `#ccc`/`#fff` strokes
- `toast.tsx` — Radix `group-[.destructive]` selectors (library-managed)

**Replacement rules** (if any new violations are found during pass):
- `bg-white` → `bg-background` or `bg-card`
- `text-black` → `text-foreground`
- `text-gray-*` → `text-muted-foreground`
- `border-gray-*` → `border-border`
- Any `text-{color}-*` → `text-status-{semantic}-foreground`
- Any `bg-{color}-*` → `bg-status-{semantic}-bg`
- Any `border-{color}-*` → `border-status-{semantic}`
- Any `hsl(literal)` → `hsl(var(--chart-*))`

### NEW Step 6: Validation

After all migrations, verify the system works by temporarily changing CSS variables in `:root`:

1. Change `--background` → all page backgrounds must update
2. Change `--foreground` → all text must update
3. Change `--card` → all card backgrounds must update
4. Change `--primary` → all primary buttons and accents must update
5. Change `--status-success` → all success indicators must update
6. Change `--chart-cash` → all cash chart colors must update

Any element that does not respond is a bug and must be fixed.

### NEW Constraint

Added to the existing constraints section:

- Zero hardcoded Tailwind default color palette classes in any component (gray, blue, green, red, amber, orange, purple, yellow, slate, zinc)
- The only allowed color usage is via semantic tokens defined in `index.css` and mapped in `tailwind.config.ts`
- Exceptions must be explicitly documented (data colors, library internals)

### Files Changed

Same as existing plan — no new files added:

| File | Action |
|---|---|
| `src/index.css` | Add status + chart CSS variables (Step 1) |
| `tailwind.config.ts` | Add status + chart color mappings (Step 2) |
| `src/lib/theme.ts` | Include new variables in preset (Step 2) |
| `src/components/TareasPanel.tsx` | Replace hardcoded status colors (Step 3) |
| `src/components/EstadisticasPanel.tsx` | Replace hardcoded chart/status colors + hsl literals (Step 3) |
| `src/components/InviteUserDialog.tsx` | Replace hardcoded status colors (Step 3) |
| `src/components/OrganizationSettings.tsx` | Replace hardcoded status colors (Step 3) |
| `src/components/SueldosPanel.tsx` | Replace hardcoded status colors (Step 3) |
| `src/components/tareas/TareaFormDialog.tsx` | Replace hardcoded status colors (Step 3) |

