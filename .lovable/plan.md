# Plan de fix — Caja: modal de anulación + monto con recargo

Dos cambios acotados, sólo de UI/presentación. No se toca lógica de negocio, guardado, ni BD.

---

## Bug 1 — Motivo de anulación: pasar de Textarea a Select

**Archivo:** `src/components/VoidTransactionDialog.tsx`

**Hallazgo:** El motivo se captura hoy con `<Textarea>` libre (líneas 73–84), validando sólo que no esté vacío. El valor se pasa tal cual a `onConfirm(reason)`, que en `DailySummary.tsx` (líneas 880–891) sólo lo usa para llamar a `onVoidTransaction(id, voidedBy, voidedById)` — el motivo no se persiste por ese path actualmente, así que cambiar el formato del input no rompe ninguna lectura aguas abajo.

**Cambio propuesto:**

1. Reemplazar el `<Textarea>` por un `<Select>` (shadcn/ui, ya disponible en `src/components/ui/select.tsx`) con estas 5 opciones fijas, en este orden:
   - Error en el método de pago
   - Cobro incorrecto
   - Cliente canceló después de pagar
   - Servicio no realizado
   - Otros
2. Estado: cambiar `reason` de string libre a una de esas 5 etiquetas. Mantener `reason.trim().length === 0` ⇒ deshabilita "Confirmar anulación" (placeholder "Seleccioná un motivo").
3. Eliminar `REASON_MAX`, el contador `{reason.length}/{REASON_MAX}` y el import de `Textarea`. Importar `Select, SelectTrigger, SelectValue, SelectContent, SelectItem`.
4. Mantener intactos: props del componente, firma de `onConfirm(reason: string)`, flujo de PIN, toasts, copy del header/description, botones del footer.

**Nota:** Si más adelante se decide persistir el motivo, ya queda normalizado a un set cerrado de etiquetas, lo cual es deseable para reportes.

---

## Bug 2 — Vista de Caja muestra base sin recargo

**Archivo:** `src/components/DailySummary.tsx`

**Hallazgo:**

- En `src/types/barbershop.ts` la `Transaction` tiene:
  - `total` → **BASE** de la venta (servicios + productos − descuentos).
  - `totalCobrado` → `total + recargoTotal` (lo que efectivamente entra a caja).
- En `useTransactions.ts` (línea 164) ya se hidrata `totalCobrado` desde `ventas.total_cobrado` con fallback a `baseTotal + recargoTotal`.
- `TransactionDetailDrawer.tsx` (línea 34) ya usa el patrón correcto: `transaction?.totalCobrado ?? transaction?.total`.
- En la **lista de transacciones del día** (`DailySummary.tsx` línea 847) se renderiza `${tx.total.toLocaleString()}` — éste es el bug visual: ignora el recargo.

**Cambio propuesto (única línea afectada para el monto visible):**

- Línea 847: reemplazar
  ```tsx
  ${tx.total.toLocaleString()}
  ```
  por
  ```tsx
  ${(tx.totalCobrado ?? tx.total).toLocaleString()}
  ```

Con el fallback a `tx.total` preservamos retrocompatibilidad con transacciones viejas anteriores al recargo (donde `totalCobrado` puede no existir).

**No se toca:**
- Cálculo de comisiones, splits por método (`efectivoAmt` / `mpAmt` ya vienen de `tx.payments` que sí incluyen recargo en `amount`).
- `staleByBarber`, lógica de cierre, ni nada de `useTransactions.ts`.
- El campo `tx.discount` (línea 851) que sigue mostrándose igual.

---

## Orden de aplicación
1. `VoidTransactionDialog.tsx` — Select de motivos.
2. `DailySummary.tsx` — un solo string interpolado.

## Riesgos
- **Bug 1:** ninguno funcional; cambio puro de input. Si en el futuro se persiste el motivo, el valor será una de 5 strings fijas (deseable).
- **Bug 2:** ninguno; `tx.totalCobrado` ya está calculado y poblado en el hook, el resto del módulo (drawer, splits por método de pago) ya lo trata correctamente. El fallback `?? tx.total` cubre datos legacy.

## Qué NO tocar
- Edge functions, migraciones, `useTransactions.ts`, lógica de PIN, lógica de cierre, comisiones, `TransactionDetailDrawer`, y cualquier otro consumo de `tx.total` fuera de la línea 847.
