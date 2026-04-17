

## Plan: Move turnos viewer, remove client name, rebrand to Vittro

### 1. Move `DailyTurnosViewer` below the payment flow in `PaymentRegistration.tsx`
- Move `<DailyTurnosViewer />` from above the "Nuevo Cobro" header to below the entire step flow (end of the component's JSX)

### 2. Remove client name from turno rows in `DailyTurnosViewer.tsx`
- Remove the `<span>` showing `turno.cliente_nombre` (line 129) and the separator dot (line 130)
- Resulting row order: time → service → barber → status badge

### 3. Rebrand "Scissors" → "Vittro"

**`index.html`** — Update all meta tags:
- `<title>Vittro</title>`
- description: "Reserva tu turno fácilmente con Vittro"
- author, og:title, og:description, twitter:site → Vittro

**`src/pages/Index.tsx`** — Change the welcome screen text from "Scissors" to "Vittro"

Note: Lucide icon imports named `Scissors` (the scissor icon) used for barbero role badges across other components are unrelated to the app name and will NOT be changed.

### Files changed

| File | Action |
|---|---|
| `src/components/PaymentRegistration.tsx` | Move `<DailyTurnosViewer />` to below the flow |
| `src/components/DailyTurnosViewer.tsx` | Remove client name field from turno rows |
| `index.html` | Rebrand all meta tags to Vittro |
| `src/pages/Index.tsx` | Change welcome screen title to Vittro |

