

## Plan: Pagos Combinados (Mixed Payments)

### Architecture Overview

```text
BEFORE:  venta.metodo_pago = 'efectivo' | 'mercado_pago'  (single value)
AFTER:   venta.metodo_pago = 'efectivo' | 'mercado_pago'  (legacy, kept for backward compat)
         + NEW TABLE: venta_pagos (source of truth for new sales)
```

### Database Changes

**1. New table `venta_pagos`**
```sql
CREATE TABLE public.venta_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES public.venta(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  sucursal_id uuid,
  metodo_pago text NOT NULL,  -- 'efectivo', 'mercado_pago', future: 'transferencia', 'tarjeta'
  monto numeric NOT NULL DEFAULT 0,
  orden integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.venta_pagos ENABLE ROW LEVEL SECURITY;

-- Same RLS as venta
CREATE POLICY "Owner GM manager full access venta_pagos" ON public.venta_pagos
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'general_manager') OR has_role(auth.uid(),'manager')))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'general_manager') OR has_role(auth.uid(),'manager')));

CREATE POLICY "Barber can view own venta_pagos" ON public.venta_pagos
  FOR SELECT TO authenticated
  USING (venta_id IN (SELECT id FROM venta WHERE barbero_id = get_user_barbero_id(auth.uid())));
```

**2. Legacy field `venta.metodo_pago`**: Keep as-is. For mixed payments, store `'efectivo'` (the primary/larger amount). New sales always write to `venta_pagos` as source of truth.

**3. No changes to `ingresos`**: Cash closing already stores `efectivo` and `mp` as separate numeric fields. The calculation logic just needs to read from `venta_pagos` instead of `tx.paymentMethod`.

### Frontend Data Model Changes

**`src/types/barbershop.ts`** -- Extend `Transaction`:
```ts
// Add to Transaction interface:
payments?: { method: PaymentMethod; amount: number }[];
```

- Single-method sales: `payments` has 1 entry (or is undefined for historical data)
- Combined sales: `payments` has 2 entries
- The existing `paymentMethod` field stays for backward compat / simple display

**`PaymentRegistration` `onSubmit` signature`**: Add optional `payments` array.

### Component Changes

**1. `PaymentRegistration.tsx` -- Payment step UI**
- Keep current Efectivo / Mercado Pago buttons for simple selection
- Add "Combinar métodos" link/button below the two buttons
- When activated: show two `CurrencyInput` fields (one per method), auto-complete the second field
- Validation: sum must equal total exactly; no amount > total
- On submit: pass `payments` array alongside legacy `paymentMethod`

**2. `useTransactions.ts`**
- `addTransaction`: After inserting `venta`, also insert rows into `venta_pagos` (always, even for single-method -- 1 row)
- `loadTransactionsByDate`: Also fetch `venta_pagos` for each venta and populate `Transaction.payments`
- For historical ventas without `venta_pagos` rows: synthesize from `metodo_pago` + `total_final`

**3. `useCashClosing.ts`**
- Change efectivo/mp calculation: use `tx.payments` array to split amounts instead of `tx.paymentMethod === 'efectivo'`
- Fallback for historical: if no `payments`, use legacy single-method logic

**4. `DailySummary.tsx`**
- `barberSummaries` aggregation: use `tx.payments` to split amounts per method
- Transaction list display: for mixed payments, show both icons + amounts inline (e.g., "Efectivo $16.000 / MP $1.000")
- `getDailySummary` in `useTransactions.ts`: split totals using `payments` array

**5. `BackfillWizard` / `useBackfillClosing.ts`**: No changes needed -- backfill doesn't go through `venta_pagos` (it writes directly to `ingresos`).

**6. `EstadisticasPanel.tsx`**: No changes -- reads from `ingresos` table which already has split `efectivo`/`mp` fields.

### UX Flow

```text
Payment Step (current):
  [ Efectivo ]  [ Mercado Pago ]
  
  [ Combinar métodos de pago ]   <-- new link

When "Combinar" is tapped:
  ┌──────────────────────────────┐
  │ Efectivo      [___16.000___] │  <- CurrencyInput, auto-fills remainder
  │ Mercado Pago  [____1.000___] │  <- CurrencyInput, auto-fills remainder
  │                              │
  │ Total: $17.000    ✓ OK       │
  │                              │
  │ [ Cancelar combinación ]     │
  └──────────────────────────────┘
```

### Files to Create/Modify

| File | Action |
|---|---|
| **Migration SQL** | Create `venta_pagos` table + RLS |
| `src/types/barbershop.ts` | Add `payments` to `Transaction` |
| `src/components/PaymentRegistration.tsx` | Add combined payment UI in payment step |
| `src/hooks/useTransactions.ts` | Insert/read `venta_pagos`, populate `payments` |
| `src/hooks/useCashClosing.ts` | Use `payments` array for efectivo/mp split |
| `src/components/DailySummary.tsx` | Display mixed payments, fix aggregation |

### What stays unchanged
- `ingresos` table and structure
- `EstadisticasPanel` (reads from `ingresos`)
- `BackfillWizard` / `useBackfillClosing`
- Commission calculation (still based on `total`)
- Discount logic (unchanged)
- Turnos / agenda system
- All existing historical data

### Risks & Decisions
- **Legacy compat**: Historical ventas without `venta_pagos` rows fall back to synthesizing a single payment from `metodo_pago` + `total_final`
- **Discount by payment method**: For combined payments, the discount step happens before payment, so payment-restricted discounts will show a warning if the user later combines methods. The discount validation already exists and will be preserved.
- **Future extensibility**: `venta_pagos.metodo_pago` is `text` not enum, allowing easy addition of `transferencia`, `tarjeta` later

